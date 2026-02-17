import { createPublicClient, http, formatEther } from 'viem';
import { base } from 'viem/chains';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { db } from '../db';
import { tokens, prices, transactions, wallets } from '../db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import axios from 'axios';
import { CacheService } from './CacheService';
import pLimit from 'p-limit';
import { HeliusDASService } from './HeliusDASService';

// Initialize Clients (Internal variables for lazy loading)
let _evmClient: any = null;
let _solanaConnection: Connection | null = null;

export const getEvmClient = () => {
    if (_evmClient) return _evmClient;
    const evmRpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
    _evmClient = createPublicClient({
        chain: base,
        transport: http(evmRpcUrl),
    });
    return _evmClient;
};

export const getSolanaConnection = () => {
    if (_solanaConnection) return _solanaConnection;
    const solRpcUrl = process.env.HELIUS_RPC_URL || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    _solanaConnection = new Connection(solRpcUrl, 'confirmed');
    return _solanaConnection;
};

export interface PortfolioAsset {
    symbol: string;
    name: string;
    balance: number;
    formattedBalance?: string;
    value: number;
    price: number;
    change: number;
    color: string;
    chain: 'EVM' | 'SOLANA';
    address?: string; // Mint on Solana, Contract on EVM
    history?: number[];
    isStaked?: boolean;
    logo?: string;

    // NEW: Enhanced metadata
    platform?: string; // Launchpad/DEX (e.g., "Clanker", "Uniswap", "Raydium")
    liquidity?: number; // Token liquidity
    volume24h?: number; // 24h volume
    marketCap?: number; // Market cap
    decimals?: number; // Token decimals
    description?: string; // Token description
    website?: string; // Project website
    twitter?: string; // Twitter handle
    dataQuality?: 'complete' | 'good' | 'basic'; // Metadata completeness
    pairCreatedAt?: number; // When pool was created
    priceChange1h?: number; // 1h price change
    priceChange24h?: number; // 24h price change (replaces 'change')
    priceChange7d?: number; // 7d price change
}

export interface TokenMetadata {
    symbol: string;
    name: string;
    decimals?: number;
    source?: string;
    rank?: number;
    logo?: string;
}

export interface BackendTransaction {
    wallet: string;
    walletAddress?: string;
    type: string;
    label?: string;
    amount: string;
    symbol: string;
    value?: number;
    time: string;
    status: string;
    signature: string;
    timestamp: number;
    chain: string;
    swapDetails?: {
        sold: string;
        bought: string;
        label: string;
        otherAmount: string;
        otherSymbol: string;
    };
}

export class PortfolioService {
    private static walletLimit = pLimit(20); // Max 20 concurrent wallet fetches
    private static apiLimit = pLimit(10); // Max 10 concurrent API calls

    private static COIN_MAP: Record<string, string> = {
        'ETH': 'ethereum',
        'SOL': 'solana',
        'BTC': 'bitcoin',
        'USDC': 'usd-coin',
        'BONK': 'bonk',
        'MSOL': 'marinade-staked-sol'
    };

    private static LOGO_MAP: Record<string, string> = {
        'SOL': 'https://cryptologos.cc/logos/solana-sol-logo.svg?v=024',
        'ETH': 'https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=024',
        'USDC': 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=024'
    };

    static async upsertTokenMetadata(asset: Partial<PortfolioAsset>) {
        if (!asset.address) return;
        try {
            await db.insert(tokens).values({
                id: asset.address,
                chain: asset.chain || 'EVM',
                symbol: asset.symbol || '?',
                name: asset.name || 'Unknown',
                decimals: 18, // Default, update later if known
                logo: asset.logo,
                priority: 1, // Auto-mark for refresh if spotted in a portfolio
                updatedAt: Math.floor(Date.now() / 1000)
            }).onConflictDoUpdate({
                target: tokens.id,
                set: {
                    logo: asset.logo,
                    priority: 1, // Ensure it stays in the refresh loop
                    updatedAt: Math.floor(Date.now() / 1000)
                }
            });
        } catch (err) {
            console.error('[DB] Upsert failed:', (err as any).message);
        }
    }

    /**
     * Fetch real transactions from the chains with pagination
     */
    static async getRecentTransactions(wallets: { address: string; chainType: 'evm' | 'solana'; label?: string }[]): Promise<BackendTransaction[]> {
        const allTransactions: BackendTransaction[] = [];

        // 1. Separate Solana and EVM wallets
        const solanaWallets = wallets.filter(w => w.chainType === 'solana');
        const evmWallets = wallets.filter(w => w.chainType === 'evm');

        // 2. Process Solana wallets with batch metadata
        if (solanaWallets.length > 0) {
            const solanaTxsByWallet: { wallet: any, txs: any[] }[] = [];
            const uniqueMints = new Set<string>();

            // Collect all Solana transactions in parallel
            const solanaResults = await Promise.allSettled(
                solanaWallets.map(wallet =>
                    HeliusDASService.getTransactions(wallet.address, { limit: 100 })
                        .then(txs => ({ wallet, txs }))
                )
            );
            for (const result of solanaResults) {
                if (result.status === 'fulfilled') {
                    solanaTxsByWallet.push(result.value);
                    for (const tx of result.value.txs) {
                        if (tx.tokenTransfers) {
                            tx.tokenTransfers.forEach((t: any) => uniqueMints.add(t.mint));
                        }
                    }
                } else {
                    console.error(`[Portfolio] Solana fetch failed:`, result.reason?.message);
                }
            }

            // Batch fetch metadata for all discovered mints
            const metadataMap = await HeliusDASService.getAssetsBatch(Array.from(uniqueMints));

            // Process collected Solana transactions with metadata
            for (const { wallet, txs } of solanaTxsByWallet) {
                for (const tx of txs) {
                    const txType = tx.type || 'Activity';
                    let amount = '0';
                    let symbol = 'SOL';
                    let swapDetails = undefined;

                    // Helper to get consistent symbols from metadata
                    const getMintSymbol = (mint: string): string => {
                        if (mint === 'So11111111111111111111111111111111111111112') return 'SOL';
                        if (mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') return 'USDC';
                        if (mint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') return 'USDT';
                        return metadataMap[mint]?.symbol || mint.slice(0, 6);
                    };

                    // Parse amount based on transaction type
                    if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
                        const transfer = tx.tokenTransfers[0];
                        amount = transfer.tokenAmount?.toString() || '0';
                        symbol = getMintSymbol(transfer.mint);
                    } else if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
                        const nativeTransfer = tx.nativeTransfers[0];
                        amount = (nativeTransfer.amount / 1_000_000_000).toFixed(6);
                        symbol = 'SOL';
                    }

                    // Parse swap details
                    if (txType === 'SWAP' && tx.tokenTransfers && tx.tokenTransfers.length >= 2) {
                        const sold = tx.tokenTransfers.find((t: any) => t.fromUserAccount === wallet.address);
                        const bought = tx.tokenTransfers.find((t: any) => t.toUserAccount === wallet.address);

                        if (sold && bought) {
                            const STABLECOIN_MINTS = new Set([
                                'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
                                'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
                            ]);
                            const NATIVE_MINTS = new Set([
                                'So11111111111111111111111111111111111111112', // SOL
                            ]);

                            const getTier = (mint: string): number => {
                                if (STABLECOIN_MINTS.has(mint)) return 0;
                                if (NATIVE_MINTS.has(mint)) return 1;
                                return 2;
                            };

                            const soldTier = getTier(sold.mint);
                            const boughtTier = getTier(bought.mint);
                            const soldSymbol = getMintSymbol(sold.mint);
                            const boughtSymbol = getMintSymbol(bought.mint);

                            let action: string;
                            if (soldTier < boughtTier) action = 'Buy';
                            else if (soldTier > boughtTier) action = 'Sell';
                            else action = 'Swap';

                            const primaryIsBought = boughtTier >= soldTier;
                            const primarySymbol = primaryIsBought ? boughtSymbol : soldSymbol;
                            const primaryAmount = primaryIsBought ? bought.tokenAmount : sold.tokenAmount;
                            const secondarySymbol = primaryIsBought ? soldSymbol : boughtSymbol;
                            const secondaryAmount = primaryIsBought ? sold.tokenAmount : bought.tokenAmount;

                            const label = action === 'Buy'
                                ? `Bought ${primaryAmount} ${primarySymbol} for ${secondaryAmount} ${secondarySymbol}`
                                : action === 'Sell'
                                    ? `Sold ${primaryAmount} ${primarySymbol} for ${secondaryAmount} ${secondarySymbol}`
                                    : `Swapped ${sold.tokenAmount} ${soldSymbol} → ${bought.tokenAmount} ${boughtSymbol}`;

                            swapDetails = {
                                sold: sold.mint,
                                bought: bought.mint,
                                action,
                                label,
                                otherAmount: bought.tokenAmount?.toString() || '0',
                                otherSymbol: boughtSymbol
                            };
                        }
                    }

                    const txData: BackendTransaction = {
                        wallet: wallet.address,
                        walletAddress: wallet.address,
                        type: txType,
                        amount,
                        symbol,
                        time: new Date(tx.timestamp * 1000).toLocaleTimeString(),
                        status: (tx.transactionError ? 'FAILED' : 'CONFIRMED') as string,
                        signature: tx.signature,
                        timestamp: tx.timestamp * 1000,
                        chain: 'SOLANA',
                        swapDetails,
                        label: wallet.label || undefined
                    };

                    allTransactions.push(txData);

                    // Persist to DB (Fire and forget) — upsert so corrected data overwrites old bad rows
                    db.insert(transactions).values({
                        signature: tx.signature,
                        walletAddress: wallet.address,
                        chain: 'SOLANA',
                        type: txType,
                        symbol,
                        amount,
                        timestamp: tx.timestamp || 0,
                        status: tx.transactionError ? 'FAILED' : 'CONFIRMED',
                        rawData: JSON.stringify(tx)
                    }).onConflictDoUpdate({
                        target: transactions.signature,
                        set: {
                            amount,
                            walletAddress: wallet.address,
                            status: tx.transactionError ? 'FAILED' : 'CONFIRMED',
                            rawData: JSON.stringify(tx),
                        }
                    }).catch(e => {
                        if (!e.message.includes('TIMEOUT')) {
                            console.error(`[DB] Solana tx insert failed: ${e.message}`);
                        }
                    });
                }
            }
        }

        // 3. Process EVM wallets in parallel
        const alchemyUrl = process.env.BASE_RPC_URL;
        if (alchemyUrl && alchemyUrl.includes('alchemy') && evmWallets.length > 0) {
            // Fetch all wallets' transfers in parallel
            const evmResults = await Promise.allSettled(
                evmWallets.map(async (wallet) => {
                    const [incoming, outgoing] = await Promise.all([
                        axios.post(alchemyUrl, {
                            jsonrpc: '2.0', id: 1,
                            method: 'alchemy_getAssetTransfers',
                            params: [{ fromBlock: '0x0', toAddress: wallet.address, category: ['external', 'erc20'], maxCount: '0x64' }]
                        }),
                        axios.post(alchemyUrl, {
                            jsonrpc: '2.0', id: 2,
                            method: 'alchemy_getAssetTransfers',
                            params: [{ fromBlock: '0x0', fromAddress: wallet.address, category: ['external', 'erc20'], maxCount: '0x64' }]
                        })
                    ]);
                    return {
                        wallet,
                        transfers: [
                            ...incoming.data.result.transfers.map((t: any) => ({ ...t, type: 'Receive' })),
                            ...outgoing.data.result.transfers.map((t: any) => ({ ...t, type: 'Send' }))
                        ]
                    };
                })
            );

            // Collect all transfers and unique price keys for batch lookup
            const allEvmTransfers: { wallet: any; tx: any }[] = [];
            const priceKeys = new Set<string>();
            for (const result of evmResults) {
                if (result.status === 'fulfilled') {
                    const { wallet, transfers } = result.value;
                    console.log(`[EVM] Fetched ${transfers.length} transfers for ${wallet.address}`);
                    for (const tx of transfers) {
                        allEvmTransfers.push({ wallet, tx });
                        if (tx.rawContract?.address) priceKeys.add(tx.rawContract.address.toLowerCase());
                        if (tx.asset) priceKeys.add(tx.asset.toUpperCase());
                    }
                } else {
                    console.error('[EVM] History failed:', result.reason?.message);
                }
            }

            // Batch price lookup — 1 query instead of N per transfer
            const priceMap = new Map<string, number>();
            if (priceKeys.size > 0) {
                try {
                    const priceRows = await db.select({ tokenAddress: prices.tokenAddress, price: prices.price })
                        .from(prices)
                        .where(inArray(prices.tokenAddress, Array.from(priceKeys)));
                    for (const row of priceRows) {
                        if (row.price) priceMap.set(row.tokenAddress, row.price);
                    }
                } catch { /* price lookup optional */ }
            }

            // Process transfers with pre-fetched prices
            for (const { wallet, tx } of allEvmTransfers) {
                let amount: string;
                if (tx.rawContract?.value && tx.rawContract?.decimal) {
                    try {
                        const rawVal = BigInt(tx.rawContract.value);
                        const decimals = parseInt(tx.rawContract.decimal, 16);
                        const divisor = BigInt(10) ** BigInt(decimals);
                        const whole = rawVal / divisor;
                        const remainder = rawVal % divisor;
                        const fracStr = remainder.toString().padStart(decimals, '0').slice(0, 6);
                        amount = `${whole}.${fracStr}`.replace(/\.?0+$/, '') || '0';
                    } catch {
                        amount = tx.value?.toString() || '0';
                    }
                } else if (tx.value !== null && tx.value !== undefined) {
                    amount = tx.value.toString();
                } else {
                    amount = '0';
                }

                const symbol = tx.asset || '?';
                const price = (tx.rawContract?.address ? priceMap.get(tx.rawContract.address.toLowerCase()) : undefined)
                    || priceMap.get(symbol.toUpperCase()) || 0;
                const valueUsd = parseFloat(amount) * price;

                allTransactions.push({
                    wallet: wallet.address, walletAddress: wallet.address,
                    type: tx.type, amount, symbol, value: valueUsd,
                    time: new Date(tx.metadata?.blockTimestamp || Date.now()).toLocaleTimeString(),
                    status: 'CONFIRMED', signature: tx.hash,
                    timestamp: new Date(tx.metadata?.blockTimestamp || Date.now()).getTime(),
                    chain: 'EVM', label: wallet.label || undefined
                });

                // Persist to DB (fire and forget)
                db.insert(transactions).values({
                    signature: tx.hash, walletAddress: wallet.address, chain: 'EVM',
                    type: tx.type, symbol, amount, valueUsd: valueUsd || null,
                    timestamp: Math.floor(new Date(tx.metadata?.blockTimestamp || Date.now()).getTime() / 1000),
                    status: 'CONFIRMED', rawData: JSON.stringify(tx)
                }).onConflictDoUpdate({
                    target: transactions.signature,
                    set: { amount, valueUsd: valueUsd || null, walletAddress: wallet.address, status: 'CONFIRMED', rawData: JSON.stringify(tx) }
                }).catch(e => {
                    if (!e.message.includes('TIMEOUT')) console.error(`[DB] EVM tx insert failed: ${e.message}`);
                });
            }
        }

        return allTransactions.sort((a, b) => b.timestamp - a.timestamp);
    }


    /**
     * Top markets — pure DB read. Data populated by HighFrequencyRefresher.
     */
    static async getTopMarkets(limit: number): Promise<any[]> {
        // Only return GLOBAL market leaders (Binance-sourced majors like BTC, ETH, SOL...)
        const results = await db
            .select({
                tokenAddress: prices.tokenAddress,
                price: prices.price,
                priceChange24h: prices.priceChange24h,
                volume24h: prices.volume24h,
                mcap: prices.mcap,
                sparkline: prices.sparkline,
                symbol: tokens.symbol,
                name: tokens.name,
                logo: tokens.logo,
                priority: tokens.priority,
            })
            .from(prices)
            .innerJoin(tokens, eq(prices.tokenAddress, tokens.id))
            .where(eq(tokens.chain, 'GLOBAL'))
            .orderBy(sql`${prices.mcap} DESC NULLS LAST`)
            .limit(limit);

        return results.map(r => ({
            symbol: r.symbol,
            name: r.name,
            price: r.price,
            change: r.priceChange24h || 0,
            image: r.logo || `https://ui-avatars.com/api/?name=${r.symbol}&background=random`,
            history: r.sparkline ? JSON.parse(r.sparkline) : []
        }));
    }

    private static async getTokenMetadata(mint: string): Promise<TokenMetadata> {
        try {
            const response = await axios.get(`https://tokens.jup.ag/token/${mint}`, { timeout: 3000 });
            if (response.data) {
                return {
                    symbol: response.data.symbol,
                    name: response.data.name,
                    logo: response.data.logoURI
                };
            }
        } catch { }
        return { symbol: mint.slice(0, 6).toUpperCase(), name: 'Unknown' };
    }

    /**
     * Fetch Solana assets using Helius DAS API
     */
    static async getHeliusAssets(address: string): Promise<PortfolioAsset[]> {
        const heliusUrl = process.env.HELIUS_RPC_URL;
        if (!heliusUrl) {
            console.warn('[Helius] RPC URL not configured, falling back to legacy indexing.');
            return this.getSPLBalancesLegacy(address);
        }

        try {
            const response = await axios.post(heliusUrl, {
                jsonrpc: '2.0',
                id: 'my-id',
                method: 'getAssetsByOwner',
                params: {
                    ownerAddress: address,
                    page: 1,
                    limit: 1000,
                    displayOptions: {
                        showFungible: true,
                        showNativeBalance: true
                    }
                }
            }, { timeout: 6000 });

            const items = response.data.result.items;
            const assets: PortfolioAsset[] = [];

            // Filter fungible tokens with non-zero balances
            const fungibleItems = items.filter((item: any) =>
                (item.interface === 'FungibleToken' || item.interface === 'FungibleAsset') &&
                (item.token_info?.balance / Math.pow(10, item.token_info?.decimals || 0)) > 0.000001
            );

            // Batch price lookup — 1 query instead of N
            const mintAddresses = fungibleItems.map((item: any) => item.id);
            const priceRows = mintAddresses.length > 0
                ? await db.query.prices.findMany({
                    where: and(inArray(prices.tokenAddress, mintAddresses), eq(prices.chain, 'SOLANA'))
                })
                : [];
            const priceMap = new Map(priceRows.map(p => [p.tokenAddress, p]));

            for (const item of fungibleItems) {
                const balance = item.token_info?.balance / Math.pow(10, item.token_info?.decimals || 0);
                const priceData = priceMap.get(item.id);

                const asset = {
                    symbol: item.content?.metadata?.symbol || item.token_info?.symbol || '?',
                    name: item.content?.metadata?.name || 'Unknown Token',
                    balance,
                    value: balance * (priceData?.price || 0),
                    price: priceData?.price || 0,
                    change: priceData?.priceChange24h || 0,
                    color: '#9945FF',
                    chain: 'SOLANA' as const,
                    address: item.id,
                    logo: item.content?.links?.image || (item.token_info?.symbol ? (this.LOGO_MAP as any)[item.token_info.symbol] : undefined)
                };
                assets.push(asset);
                this.upsertTokenMetadata(asset);
            }
            return assets;
        } catch (err: any) {
            console.error('[Helius] DAS API failed:', err.message);
            return this.getSPLBalancesLegacy(address);
        }
    }

    static async getSPLBalancesLegacy(address: string): Promise<PortfolioAsset[]> {
        const conn = getSolanaConnection();
        const pubkey = new PublicKey(address);
        const tokenAccounts = await Promise.race([
            conn.getParsedTokenAccountsByOwner(pubkey, { programId: TOKEN_PROGRAM_ID }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SPL balance fetch timed out (6s)')), 6000))
        ]);
        const assets: PortfolioAsset[] = [];

        for (const account of tokenAccounts.value) {
            const info = account.account.data.parsed.info;
            const mint = info.mint;
            const balance = info.tokenAmount.uiAmount;
            if (balance > 0.000001) {
                const meta = await this.getTokenMetadata(mint);
                assets.push({
                    symbol: meta.symbol,
                    name: meta.name,
                    balance,
                    value: 0,
                    price: 0,
                    change: 0,
                    color: '#9945FF',
                    chain: 'SOLANA',
                    logo: meta.logo || (this.LOGO_MAP as any)[meta.symbol]
                });
            }
        }
        return assets;
    }

    // getContractPrices removed — replaced by DB reads + Jupiter/DexScreener fallback

    static async getJupiterPrices(mints: string[]): Promise<Record<string, { price: number; change: number }>> {
        if (mints.length === 0) return {};
        const results: Record<string, { price: number; change: number }> = {};
        try {
            // Updated to v6 API (v2 requires auth now)
            const response = await axios.get(`https://api.jup.ag/price/v6?ids=${mints.join(',')}`, { timeout: 5000 });
            const data = response.data.data;
            for (const mint of mints) {
                if (data[mint]) {
                    results[mint] = {
                        price: parseFloat(data[mint].price),
                        change: 0
                    };
                }
            }
        } catch (err: any) {
            const status = err.response?.status;
            if (status === 401) {
                console.warn('[Jupiter] 401 Unauthorized — API may require auth now. Using DexScreener fallback.');
            } else {
                console.warn(`[Jupiter] Price API failed (${status || err.code || err.message})`);
            }
        }
        return results;
    }

    // get1inchBasePrices removed — no API key, replaced by DexScreener
    // getPrices (CoinGecko simple/price) removed — replaced by DB reads

    static async getAggregatedPortfolio(wallets: { address: string; chainType: 'evm' | 'solana' }[]): Promise<any> {
        const assets: PortfolioAsset[] = [];
        let totalValue = 0;

        // Batch process wallets with concurrency control and caching
        const walletResults = await Promise.allSettled(
            wallets.map(wallet => this.walletLimit(async () => {
                const cacheKey = `wallet:${wallet.chainType}:${wallet.address}`;

                // Try cache first (30 second TTL for wallet balances)
                const cached = await CacheService.get<PortfolioAsset[]>(cacheKey);
                if (cached) return cached.map(a => ({ ...a, walletAddress: wallet.address }));

                let walletAssets: PortfolioAsset[] = [];

                try {
                    if (wallet.chainType === 'solana') {
                        // Validate Solana address is valid base58 before using it
                        let pubkey: PublicKey;
                        try {
                            pubkey = new PublicKey(wallet.address);
                        } catch {
                            console.warn(`[Portfolio] Skipping invalid Solana address: ${wallet.address}`);
                            return walletAssets;
                        }
                        const conn = getSolanaConnection();
                        const balance = await Promise.race([
                            conn.getBalance(pubkey),
                            new Promise<number>((_, reject) => setTimeout(() => reject(new Error('SOL balance fetch timed out (6s)')), 6000))
                        ]);
                        walletAssets.push({
                            symbol: 'SOL',
                            name: 'Solana',
                            balance: balance / LAMPORTS_PER_SOL,
                            value: 0, price: 0, change: 0, color: '#14f195', chain: 'SOLANA',
                            address: 'So11111111111111111111111111111111111111112',
                            logo: this.LOGO_MAP['SOL']
                        });
                        const spl = await this.getHeliusAssets(wallet.address);
                        walletAssets.push(...spl);
                    } else {
                        walletAssets = await this.getEvmAssets(wallet.address);
                    }

                    // Tag each asset with its source wallet address
                    walletAssets.forEach(a => (a as any).walletAddress = wallet.address);

                    // Cache successful fetch
                    await CacheService.set(cacheKey, walletAssets, 30);
                } catch (err: any) {
                    console.error(`[Portfolio] Error for wallet ${wallet.address}: ${err.message}`);
                }

                return walletAssets;
            }))
        );

        // Flatten all successful results
        walletResults.forEach(result => {
            if (result.status === 'fulfilled') {
                assets.push(...result.value);
            }
        });

        // Batch price fetching with parallel execution
        await this.enrichAssetsWithPrices(assets);

        // Calculate total value
        assets.forEach(asset => {
            totalValue += asset.value;
        });

        // Calculate 24h PnL
        let totalValue24hAgo = 0;

        assets.forEach(asset => {
            const priceChange = asset.priceChange24h || asset.change || 0;
            const price24hAgo = asset.price / (1 + priceChange / 100);
            const value24hAgo = asset.balance * price24hAgo;
            totalValue24hAgo += value24hAgo;
        });

        const portfolioPnL24h = totalValue - totalValue24hAgo;
        const portfolioPnLPercent24h = totalValue24hAgo > 0
            ? ((totalValue - totalValue24hAgo) / totalValue24hAgo) * 100
            : 0;

        return {
            assets: assets.sort((a, b) => b.value - a.value),
            totalValue: parseFloat(totalValue.toFixed(2)),
            totalChange24h: parseFloat(portfolioPnLPercent24h.toFixed(2)),
            growthValue: parseFloat(portfolioPnL24h.toFixed(2)),

            // NEW: Enhanced metrics
            networth: parseFloat(totalValue.toFixed(2)),
            networthChange24h: parseFloat(portfolioPnL24h.toFixed(2)),
            networthChangePercent24h: parseFloat(portfolioPnLPercent24h.toFixed(2)),
            assetsWithPlatform: assets.filter(a => a.platform).length,
            assetsWithCompleteData: assets.filter(a => a.dataQuality === 'complete').length,
            topGainer24h: assets.reduce((max, asset) =>
                (asset.priceChange24h || 0) > (max.priceChange24h || 0) ? asset : max,
                assets[0]
            ),
            topLoser24h: assets.reduce((min, asset) =>
                (asset.priceChange24h || 0) < (min.priceChange24h || 0) ? asset : min,
                assets[0]
            )
        };
    }

    /**
     * Enrich assets with prices — DB-first, API fallback only for missing data.
     * The HighFrequencyRefresher populates the DB periodically.
     * We only hit Jupiter (Solana) or DexScreener (Base) for assets with no DB price.
     */
    private static async enrichAssetsWithPrices(assets: PortfolioAsset[]): Promise<void> {
        // 1. Collect all unique addresses/symbols
        const allAddresses = [...new Set(assets.filter(a => a.address).map(a => a.address!))];
        const allSymbols = [...new Set(assets.map(a => a.symbol.toUpperCase()))];

        // 2. Batch read from DB — prices table
        const dbPriceMap = new Map<string, typeof prices.$inferSelect>();
        if (allAddresses.length > 0) {
            const dbPrices = await db.query.prices.findMany({
                where: inArray(prices.tokenAddress, allAddresses)
            });
            dbPrices.forEach(p => dbPriceMap.set(p.tokenAddress, p));
        }
        // Also look up by symbol (for native assets like SOL, ETH)
        const symbolPrices = await db.query.prices.findMany({
            where: inArray(prices.tokenAddress, allSymbols)
        });
        symbolPrices.forEach(p => dbPriceMap.set(p.tokenAddress, p));

        // 3. Batch read from DB — tokens table for metadata
        const dbTokenMap = new Map<string, typeof tokens.$inferSelect>();
        if (allAddresses.length > 0) {
            const dbTokens = await db.query.tokens.findMany({
                where: inArray(tokens.id, allAddresses)
            });
            dbTokens.forEach(t => dbTokenMap.set(t.id, t));
        }

        // 4. Identify assets that have NO price in DB — need API fallback
        const missingSolana: string[] = [];
        const missingBase: string[] = [];

        assets.forEach(asset => {
            if (!asset.address) return;
            const dbPrice = dbPriceMap.get(asset.address);
            if (!dbPrice || dbPrice.price === 0) {
                if (asset.chain === 'SOLANA') missingSolana.push(asset.address);
                else if (asset.chain === 'EVM') missingBase.push(asset.address);
            }
        });

        // 5. Fetch ONLY missing prices from free APIs
        // Try Jupiter for Solana; if it returns nothing (e.g. 401), fall back to DexScreener
        let jupFallback: Record<string, { price: number; change: number }> = {};
        let dexFallback: Record<string, { price: number; change: number }> = {};

        const [jupResult, dexResult] = await Promise.all([
            missingSolana.length > 0 ? this.getJupiterPrices(missingSolana) : {},
            missingBase.length > 0 ? this.getDexScreenerPrices(missingBase) : {}
        ]);
        jupFallback = jupResult;
        dexFallback = dexResult;

        // If Jupiter returned nothing for Solana, try DexScreener as fallback
        const solStillMissing = missingSolana.filter(m => !jupFallback[m]);
        if (solStillMissing.length > 0) {
            const solDexFallback = await this.getDexScreenerPrices(solStillMissing, 'solana');
            Object.assign(jupFallback, solDexFallback);
        }

        // 6. Register missing assets so the refresher picks them up next cycle
        const registrations: Promise<void>[] = [];
        [...missingSolana, ...missingBase].forEach(addr => {
            if (!dbTokenMap.has(addr)) {
                const asset = assets.find(a => a.address === addr);
                if (asset) registrations.push(this.upsertTokenMetadata(asset));
            }
        });
        if (registrations.length > 0) Promise.all(registrations).catch(() => { });

        // 7. Apply prices to assets
        assets.forEach(asset => {
            let price = 0;
            let change = 0;

            // Try DB price by address first
            if (asset.address) {
                const dbPrice = dbPriceMap.get(asset.address);
                if (dbPrice && dbPrice.price > 0) {
                    price = dbPrice.price;
                    change = dbPrice.priceChange24h || 0;
                    asset.volume24h = dbPrice.volume24h || undefined;
                    asset.marketCap = dbPrice.mcap || undefined;
                    asset.liquidity = dbPrice.liquidity || undefined;
                }
            }

            // Try DB price by symbol (for native SOL/ETH)
            if (price === 0) {
                const symPrice = dbPriceMap.get(asset.symbol.toUpperCase());
                if (symPrice && symPrice.price > 0) {
                    price = symPrice.price;
                    change = symPrice.priceChange24h || 0;
                }
            }

            // Try API fallback for missing
            if (price === 0 && asset.address) {
                const fallback = jupFallback[asset.address] || dexFallback[asset.address];
                if (fallback) {
                    price = fallback.price;
                    change = fallback.change;
                }
            }

            // Apply DB token metadata
            if (asset.address) {
                const dbToken = dbTokenMap.get(asset.address);
                if (dbToken) {
                    if (dbToken.logo && !asset.logo) asset.logo = dbToken.logo;
                    if (dbToken.description) asset.description = dbToken.description;
                    if (dbToken.website) asset.website = dbToken.website;
                    if (dbToken.twitter) asset.twitter = dbToken.twitter;
                    if (dbToken.createdAt) asset.pairCreatedAt = dbToken.createdAt;
                }
            }

            asset.price = price;
            asset.change = change;
            asset.priceChange24h = asset.priceChange24h || change;
            asset.value = asset.balance * asset.price;
        });
    }

    /**
     * DexScreener batch price lookup — free, no API key, ~300 req/min
     */
    private static async getDexScreenerPrices(addresses: string[], chain: string = 'base'): Promise<Record<string, { price: number; change: number }>> {
        const results: Record<string, { price: number; change: number }> = {};
        const chunks: string[][] = [];
        for (let i = 0; i < addresses.length; i += 30) {
            chunks.push(addresses.slice(i, i + 30));
        }
        await Promise.all(chunks.map(async (chunk) => {
            try {
                const res = await axios.get(`https://api.dexscreener.com/tokens/v1/${chain}/${chunk.join(',')}`, { timeout: 5000 });
                if (Array.isArray(res.data)) {
                    for (const pair of res.data) {
                        const addr = pair.baseToken?.address;
                        if (addr && !results[addr]) {
                            results[addr] = {
                                price: parseFloat(pair.priceUsd) || 0,
                                change: pair.priceChange?.h24 || 0
                            };
                        }
                    }
                }
            } catch { }
        }));
        return results;
    }

    // Cached wrappers removed — enrichAssetsWithPrices now reads from DB directly

    /**
     * Fetch EVM assets (Base) using Alchemy's Token API
     */
    static async getEvmAssets(address: string): Promise<PortfolioAsset[]> {
        const client = getEvmClient();
        const assets: PortfolioAsset[] = [];
        const evmRpcUrl = process.env.BASE_RPC_URL;

        if (!evmRpcUrl || !evmRpcUrl.includes('alchemy')) {
            console.warn('[Alchemy] Base RPC URL not configured or not Alchemy, falling back to native-only.');
            try {
                const balance = await client.getBalance({ address: address as `0x${string}` });
                assets.push({
                    symbol: 'ETH', name: 'Ethereum', balance: parseFloat(formatEther(balance)),
                    value: 0, price: 0, change: 0, color: '#627EEA', chain: 'EVM',
                    logo: this.LOGO_MAP['ETH']
                });
            } catch (err: any) { console.error('[EVM] Native fallback failed:', err.message); }
            return assets;
        }

        try {
            // 1. Get Native ETH Balance
            const ethBalance = await client.getBalance({ address: address as `0x${string}` });
            assets.push({
                symbol: 'ETH', name: 'Ethereum', balance: parseFloat(formatEther(ethBalance)),
                value: 0, price: 0, change: 0, color: '#627EEA', chain: 'EVM',
                logo: this.LOGO_MAP['ETH']
            });

            // 2. Discover Tokens via Alchemy
            const response = await axios.post(evmRpcUrl, {
                jsonrpc: '2.0',
                method: 'alchemy_getTokenBalances',
                params: [address],
                id: 1
            });

            const tokenBalances = response.data.result.tokenBalances;

            // Limit to top 20 tokens to avoid rate limits and slow response
            const activeTokens = tokenBalances
                .filter((t: any) => t.tokenBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000')
                .slice(0, 25);

            // Batch DB lookups: 2 queries instead of 50
            const allAddresses = activeTokens.map((t: any) => t.contractAddress);
            const [cachedTokens, cachedPrices] = await Promise.all([
                db.query.tokens.findMany({
                    where: and(inArray(tokens.id, allAddresses), eq(tokens.chain, 'EVM'))
                }),
                db.query.prices.findMany({
                    where: and(inArray(prices.tokenAddress, allAddresses), eq(prices.chain, 'EVM'))
                })
            ]);
            const tokenMap = new Map(cachedTokens.map(t => [t.id, t]));
            const priceMap = new Map(cachedPrices.map(p => [p.tokenAddress, p]));

            // Only fetch metadata from Alchemy for tokens not in our DB
            const uncachedTokens = activeTokens.filter((t: any) => !tokenMap.has(t.contractAddress));
            if (uncachedTokens.length > 0) {
                await Promise.all(uncachedTokens.map(async (token: any) => {
                    try {
                        const metaRes = await axios.post(evmRpcUrl, {
                            jsonrpc: '2.0', method: 'alchemy_getTokenMetadata',
                            params: [token.contractAddress], id: 1
                        });
                        const meta = metaRes.data.result;
                        if (meta && meta.symbol) {
                            tokenMap.set(token.contractAddress, { id: token.contractAddress, symbol: meta.symbol, name: meta.name, decimals: meta.decimals, logo: meta.logo, chain: 'EVM' } as any);
                            this.upsertTokenMetadata({ address: token.contractAddress, chain: 'EVM', symbol: meta.symbol, name: meta.name, logo: meta.logo }).catch(() => {});
                        }
                    } catch (e) {
                        console.error(`[Alchemy] Metadata failed for ${token.contractAddress}`);
                    }
                }));
            }

            // Build asset list using pre-fetched data
            for (const token of activeTokens) {
                const meta = tokenMap.get(token.contractAddress);
                if (!meta || !meta.symbol) continue;
                const decimals = meta.decimals || 18;
                const balance = parseInt(token.tokenBalance, 16) / Math.pow(10, decimals);
                if (balance <= 0.000001) continue;
                const priceData = priceMap.get(token.contractAddress);
                assets.push({
                    symbol: meta.symbol,
                    name: meta.name || meta.symbol,
                    balance,
                    value: balance * (priceData?.price || 0),
                    price: priceData?.price || 0,
                    change: priceData?.priceChange24h || 0,
                    color: '#0052FF',
                    chain: 'EVM',
                    address: token.contractAddress,
                    logo: meta.logo || undefined
                });
            }
        } catch (err) {
            console.error('[Alchemy] Token discovery failed:', (err as any).message);
        }

        return assets;
    }

    /**
     * Fetch Global Market Stats (Market Cap, Volume, Dominance, Sentiment, Gas)
     * Professional implementation for AI context and Dashboard
     */
    private static globalStatsCache: any = null;
    private static globalStatsCacheTime = 0;

    static async getGlobalStats() {
        // 5-minute in-memory cache — this data barely changes
        const age = Date.now() - this.globalStatsCacheTime;
        if (this.globalStatsCache && age < 300_000) return this.globalStatsCache;

        try {
            // Fetch all 3 APIs in parallel instead of sequentially
            const [fngRes, globalRes, gasRes] = await Promise.allSettled([
                axios.get('https://api.alternative.me/fng/', { timeout: 3000 }),
                axios.get('https://api.coingecko.com/api/v3/global', { timeout: 3000 }),
                axios.get('https://ethgasstation.info/api/ethgasAPI.json', { timeout: 2000 }),
            ]);

            const fng = fngRes.status === 'fulfilled' ? fngRes.value.data.data[0] : { value: '50', value_classification: 'Neutral' };
            const g = globalRes.status === 'fulfilled' ? globalRes.value.data.data : null;
            const gasPrice = gasRes.status === 'fulfilled' ? Math.round(gasRes.value.data.average / 10) : 18;

            if (!g) throw new Error('CoinGecko global data unavailable');

            const result = {
                marketCap: g.total_market_cap.usd,
                volume: g.total_volume.usd,
                marketCapChange24h: g.market_cap_change_percentage_24h_usd,
                btcDominance: g.market_cap_percentage.btc,
                ethDominance: g.market_cap_percentage.eth,
                activeCryptocurrencies: g.active_cryptocurrencies,
                gasPrice,
                sentiment: {
                    value: parseInt(fng.value),
                    label: fng.value_classification
                },
                updatedAt: Math.floor(Date.now() / 1000)
            };
            this.globalStatsCache = result;
            this.globalStatsCacheTime = Date.now();
            return result;
        } catch (error: any) {
            console.error('[Portfolio] Global stats fetch failed:', error.message);
            if (this.globalStatsCache) return this.globalStatsCache;
            return {
                marketCap: 0, volume: 0, btcDominance: 0, gasPrice: 20,
                sentiment: { value: 50, label: 'Neutral' }
            };
        }
    }
}
