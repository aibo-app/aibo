import axios from 'axios';
import { backendTeamClient } from './BackendTeamClient';
import { db } from '../index';
import { transactions as transactionsTable } from '../db/schema';
import { desc } from 'drizzle-orm';

const STATIC_LOGOS: Record<string, string> = {
    'ETH': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    'SOL': 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
    'USDC': 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
    'JUP': 'https://assets.coingecko.com/coins/images/34188/small/jup.png',
    'BTC': 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
    'BNB': 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
    'ARB': 'https://assets.coingecko.com/coins/images/16547/small/arb.png',
    'MATIC': 'https://assets.coingecko.com/coins/images/4713/small/polygon.png'
};

const CHAIN_LOGOS: Record<string, string> = {
    'EVM': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
    'SOLANA': 'https://assets.coingecko.com/coins/images/4128/small/solana.png'
};

const priceCache: Record<string, { price: number; timestamp: number }> = {};
const CACHE_TTL = 60000;

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

export interface BackendTransaction {
    wallet: string;
    walletAddress?: string;
    type: string;
    label?: string;
    amount: string | number;
    value?: number;
    symbol: string;
    time: string;
    status: string;
    signature: string;
    timestamp: number;
    chain: string;
    logo?: string;
    swapDetails?: {
        sold: string;
        bought: string;
        label: string;
        otherAmount: string;
        otherSymbol: string;
    };
}


export class PortfolioService {
    // In-memory portfolio cache — shared between dashboard polling and AI node commands
    private static cachedPortfolio: any = null;
    private static portfolioCacheTimestamp = 0;
    private static readonly PORTFOLIO_CACHE_TTL = 60_000; // 60s

    /**
     * Fetch aggregated portfolio via Backend Team secure proxy.
     * Uses stale-while-revalidate: returns cached data immediately if available,
     * then refreshes in the background. Only blocks on first fetch.
     */
    static async getAggregatedPortfolio(wallets: { address: string; chainType: 'evm' | 'solana' }[]): Promise<any> {
        const age = Date.now() - this.portfolioCacheTimestamp;

        // Fresh cache — return immediately
        if (this.cachedPortfolio && age < this.PORTFOLIO_CACHE_TTL) {
            return this.cachedPortfolio;
        }

        // Stale cache exists — return it now and revalidate in background
        if (this.cachedPortfolio) {
            this.revalidatePortfolio(wallets);
            return this.cachedPortfolio;
        }

        // No cache at all — must wait for first fetch
        return this.revalidatePortfolio(wallets);
    }

    private static revalidatePromise: Promise<any> | null = null;

    private static async revalidatePortfolio(wallets: { address: string; chainType: 'evm' | 'solana' }[]): Promise<any> {
        // Deduplicate concurrent revalidation requests
        if (this.revalidatePromise) return this.revalidatePromise;

        this.revalidatePromise = (async () => {
            try {
                const portfolio = await backendTeamClient.getPortfolio(wallets);
                this.cachedPortfolio = portfolio;
                this.portfolioCacheTimestamp = Date.now();
                return portfolio;
            } catch (error: any) {
                // BackendTeamClient already logs the error — just return cached/empty data
                if (this.cachedPortfolio) return this.cachedPortfolio;
                return { assets: [], totalValue: 0, totalChange24h: 0, growthValue: 0 };
            } finally {
                this.revalidatePromise = null;
            }
        })();

        return this.revalidatePromise;
    }

    /**
     * Fetch real prices from CoinGecko with 5min caching
     * Returns cached prices if API fails, but logs warnings for stale data
     */
    static async getPrices(ids: string[] = ['ethereum', 'solana']): Promise<Record<string, number>> {
        const now = Date.now();
        const results: Record<string, number> = {};
        const missingIds: string[] = [];

        const mapping: Record<string, string> = {
            'ethereum': 'ETH', 'solana': 'SOL', 'usd-coin': 'USDC', 'bitcoin': 'BTC',
            'binancecoin': 'BNB', 'arbitrum': 'ARB', 'matic-network': 'MATIC',
            'jupiter-exchange-sol-network': 'JUP'
        };

        // Load from cache
        for (const id of ids) {
            const symbol = mapping[id] || id.toUpperCase();
            if (priceCache[symbol]) {
                results[symbol] = priceCache[symbol].price;
                const age = now - priceCache[symbol].timestamp;

                // Fresh cache (< 5 min)
                if (age < CACHE_TTL) {
                    continue;
                }
                // Warn on stale cache (> 15 min)
                if (age > CACHE_TTL * 3) {
                    console.warn(`[PortfolioService] Stale price for ${symbol}: ${Math.floor(age / 60000)} minutes old`);
                }
            }
            missingIds.push(id);
        }

        // If everything is fresh, return early
        if (missingIds.length === 0) return results;

        try {
            const idString = missingIds.join(',');
            const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${idString}&vs_currencies=usd`, {
                timeout: 5000
            });

            for (const id of missingIds) {
                if (response.data[id]) {
                    const symbol = mapping[id] || id.toUpperCase();
                    const price = response.data[id].usd;
                    priceCache[symbol] = { price, timestamp: now };
                    results[symbol] = price;
                }
            }
            return results;
        } catch (err: any) {
            const errorMsg = err.response?.status === 429 ? 'Rate Limited' : err.message;
            console.warn(`[PortfolioService] Price API failed (${errorMsg}). Using cached prices.`);

            // Return whatever we have in cache, even if stale
            // This is better than returning nothing
            return results;
        }
    }

    /**
     * Unified transaction history via Backend Team with Local Persistent Cache.
     * Always prefers fresh remote data; uses cache only when remote fails.
     */
    static async getRecentTransactions(wallets: any[]): Promise<BackendTransaction[]> {
        // Always try remote first for fresh, correctly-converted data
        try {
            const remoteTxs = await backendTeamClient.getTransactions(wallets);

            if (remoteTxs && remoteTxs.length > 0) {
                // Persist to local cache (fire-and-forget, for offline fallback)
                for (const tx of remoteTxs) {
                    db.insert(transactionsTable).values({
                        signature: tx.signature,
                        walletAddress: tx.walletAddress || tx.wallet || '',
                        chain: tx.chain,
                        type: tx.type,
                        symbol: tx.symbol,
                        amount: tx.amount?.toString() || '0',
                        timestamp: tx.timestamp,
                        status: tx.status,
                        label: tx.label,
                        rawData: JSON.stringify(tx)
                    }).onConflictDoUpdate({
                        target: transactionsTable.signature,
                        set: {
                            status: tx.status,
                            amount: tx.amount?.toString() || '0',
                            walletAddress: tx.walletAddress || tx.wallet || '',
                            label: tx.label,
                            rawData: JSON.stringify(tx),
                        }
                    }).catch(() => { });
                }

                return remoteTxs.map((tx: any) => ({
                    ...tx,
                    logo: (STATIC_LOGOS as any)[tx.symbol] || tx.logo
                }));
            }
        } catch (error: any) {
            console.error('[PortfolioService] Remote tx fetch failed, falling back to cache:', error.message);
        }

        // Fallback: read from local cache only if remote fails
        try {
            const localData = await db.select()
                .from(transactionsTable)
                .orderBy(desc(transactionsTable.timestamp))
                .limit(250);

            return localData.map(tx => {
                let extra: any = {};
                try { extra = tx.rawData ? JSON.parse(tx.rawData) : {}; } catch { }
                return {
                    wallet: tx.walletAddress,
                    walletAddress: tx.walletAddress,
                    type: tx.type,
                    amount: tx.amount,
                    symbol: tx.symbol,
                    value: extra.value || 0,
                    time: new Date(tx.timestamp).toLocaleTimeString(),
                    status: tx.status,
                    signature: tx.signature,
                    timestamp: tx.timestamp,
                    chain: tx.chain,
                    label: tx.label || extra.label,
                    logo: (STATIC_LOGOS as any)[tx.symbol],
                    swapDetails: extra.swapDetails,
                } as BackendTransaction;
            });
        } catch (dbErr) {
            console.error('[PortfolioService] Local cache read failed:', dbErr);
            return [];
        }
    }

    static async getTopMarkets() {
        try {
            // Use Backend Team's curated top markets endpoint with sparklines
            const markets = await backendTeamClient.getTopMarkets(20);

            // Transform to expected format
            return markets.map((market: any) => ({
                symbol: market.symbol,
                name: market.name,
                price: `$${market.price.toLocaleString()}`,
                change: market.change > 0 ? `+${market.change.toFixed(1)}%` : `${market.change.toFixed(1)}%`,
                isUp: market.change > 0,
                logo: market.image || (STATIC_LOGOS as any)[market.symbol]
            }));
        } catch (error) {
            console.error('[PortfolioService] Top markets failed:', error);

            // Minimal graceful degradation - return empty array instead of fake data
            // The UI should handle this case
            return [];
        }
    }

    /**
     * Get detailed stats for a specific asset (price, volume, mcap, etc.)
     */
    static async getAssetStats(symbol: string) {
        try {
            const tokenData = await backendTeamClient.getTokenPrice(symbol);
            if (!tokenData) {
                return null;
            }

            return {
                symbol: tokenData.symbol,
                price: tokenData.price,
                change24h: tokenData.change24h,
                volume24h: tokenData.volume24h,
                mcap: tokenData.mcap,
                fdv: tokenData.fdv,
                liquidity: tokenData.liquidity,
                logo: tokenData.logo
            };
        } catch (error) {
            console.error(`[PortfolioService] Failed to get stats for ${symbol}:`, error);
            return null;
        }
    }

    static async getTopMovers() { return []; }
    private static cachedGlobalStats: any = null;
    private static globalStatsTimestamp: number = 0;

    static async getGlobalStats() {
        const now = Date.now();
        const cacheAge = now - this.globalStatsTimestamp;

        // Use cache if less than 1 minute old (more frequent updates for global market)
        if (this.cachedGlobalStats && cacheAge < 60 * 1000) {
            return this.cachedGlobalStats;
        }

        try {
            // Fetch from Backend Team secure proxy
            const stats = await backendTeamClient.getMarketGlobal();

            if (stats) {
                this.cachedGlobalStats = stats;
                this.globalStatsTimestamp = now;
                return stats;
            }

            // Fallback to minimal data if proxy fails
            if (this.cachedGlobalStats) return this.cachedGlobalStats;
            return null;
        } catch (err: any) {
            console.error('[PortfolioService] Global stats fetch failed:', err.message);
            return this.cachedGlobalStats || null;
        }
    }
}
