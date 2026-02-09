import { createPublicClient, http, formatEther } from 'viem';
import { base } from 'viem/chains';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import axios from 'axios';

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
    const solRpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
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
    history?: number[];
    isStaked?: boolean;
    logo?: string;
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
    type: string;
    label?: string;
    amount: string;
    symbol: string;
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

    /**
     * Fetch real transactions from the chains with pagination
     */
    static async getRecentTransactions(wallets: { address: string; chainType: 'evm' | 'solana'; label?: string }[]): Promise<BackendTransaction[]> {
        const allTransactions: BackendTransaction[] = [];
        const BATCH_SIZE = 100;
        const MAX_TRANSACTIONS = 500;

        for (const wallet of wallets) {
            try {
                if (wallet.chainType === 'solana') {
                    const conn = getSolanaConnection();
                    const pubkey = new PublicKey(wallet.address);
                    let fetchedCount = 0;
                    let lastSignature: string | undefined = undefined;

                    while (fetchedCount < MAX_TRANSACTIONS) {
                        const options: { limit: number; before?: string } = { limit: BATCH_SIZE };
                        if (lastSignature) options.before = lastSignature;

                        const signatures = await conn.getSignaturesForAddress(pubkey, options);
                        if (signatures.length === 0) break;

                        const PARALLEL_BATCH = 20;
                        for (let i = 0; i < signatures.length; i += PARALLEL_BATCH) {
                            const batch = signatures.slice(i, i + PARALLEL_BATCH);
                            const results = await Promise.all(batch.map((sigInfo: any) =>
                                conn.getParsedTransaction(sigInfo.signature, {
                                    maxSupportedTransactionVersion: 0,
                                    commitment: 'confirmed'
                                }).then((tx: any) => ({ tx, sigInfo })).catch(() => null)
                            ));

                            for (const result of results) {
                                if (!result || !result.tx) continue;
                                const { tx, sigInfo } = result;
                                const timestamp = tx.blockTime ? tx.blockTime * 1000 : Date.now();
                                const isReceived = tx.meta?.postBalances[0] > tx.meta?.preBalances[0]; // Simple heuristic for now

                                allTransactions.push({
                                    wallet: wallet.label || 'Solana Wallet',
                                    type: isReceived ? 'Received' : 'Sent',
                                    amount: '0', // Full balance diff logic can be added here
                                    symbol: 'SOL',
                                    time: new Date(timestamp).toLocaleTimeString(),
                                    status: sigInfo.err ? 'FAILED' : 'CONFIRMED',
                                    signature: sigInfo.signature,
                                    timestamp: timestamp,
                                    chain: 'SOLANA'
                                });
                            }
                        }
                        fetchedCount += signatures.length;
                        lastSignature = signatures[signatures.length - 1]?.signature;
                        if (signatures.length < BATCH_SIZE) break;
                    }
                }
            } catch (err) {
                console.error(`[TX FETCH] Error for ${wallet.address}:`, err);
            }
        }
        return allTransactions.sort((a, b) => b.timestamp - a.timestamp);
    }

    static async getTopMarkets(limit: number): Promise<any[]> {
        try {
            const response = await axios.get(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=true&price_change_percentage=24h`, { timeout: 5000 });
            return (response.data as any[]).map((coin) => ({
                symbol: coin.symbol.toUpperCase(),
                name: coin.name,
                price: coin.current_price,
                change: coin.price_change_percentage_24h,
                image: coin.image,
                history: coin.sparkline_in_7d?.price ? coin.sparkline_in_7d.price.slice(-24) : []
            }));
        } catch { return []; }
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

    static async getSPLBalances(address: string): Promise<PortfolioAsset[]> {
        const conn = getSolanaConnection();
        const pubkey = new PublicKey(address);
        const tokenAccounts = await conn.getParsedTokenAccountsByOwner(pubkey, { programId: TOKEN_PROGRAM_ID });
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

    static async getPrices(symbols: string[]): Promise<Record<string, { price: number; change: number }>> {
        const results: Record<string, { price: number; change: number }> = {};
        try {
            const ids = symbols.map(s => this.COIN_MAP[s] || s.toLowerCase()).join(',');
            const cgRes = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
            for (const s of symbols) {
                const id = this.COIN_MAP[s] || s.toLowerCase();
                const info = cgRes.data[id];
                if (info) {
                    results[s.toUpperCase()] = { price: info.usd, change: info.usd_24h_change || 0 };
                }
            }
        } catch { }
        return results;
    }

    static async getAggregatedPortfolio(wallets: { address: string; chainType: 'evm' | 'solana' }[]): Promise<any> {
        const assets: PortfolioAsset[] = [];
        let totalValue = 0;

        for (const wallet of wallets) {
            if (wallet.chainType === 'solana') {
                const conn = getSolanaConnection();
                const balance = await conn.getBalance(new PublicKey(wallet.address));
                assets.push({
                    symbol: 'SOL',
                    name: 'Solana',
                    balance: balance / LAMPORTS_PER_SOL,
                    value: 0, price: 0, change: 0, color: '#14f195', chain: 'SOLANA',
                    logo: this.LOGO_MAP['SOL']
                });
                const spl = await this.getSPLBalances(wallet.address);
                assets.push(...spl);
            } else {
                const client = getEvmClient();
                const balance = await client.getBalance({ address: wallet.address as `0x${string}` });
                assets.push({
                    symbol: 'ETH',
                    name: 'Ethereum',
                    balance: parseFloat(formatEther(balance)),
                    value: 0, price: 0, change: 0, color: '#627EEA', chain: 'EVM',
                    logo: this.LOGO_MAP['ETH']
                });
            }
        }

        const symbols = Array.from(new Set(assets.map(a => a.symbol)));
        const prices = await this.getPrices(symbols);

        assets.forEach(asset => {
            const priceInfo = prices[asset.symbol] || { price: 0, change: 0 };
            asset.price = priceInfo.price;
            asset.change = priceInfo.change;
            asset.value = asset.balance * priceInfo.price;
            totalValue += asset.value;
        });

        return { assets, totalValue };
    }
}
