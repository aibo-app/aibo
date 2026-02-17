"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortfolioService = void 0;
const axios_1 = __importDefault(require("axios"));
const BackendTeamClient_1 = require("./BackendTeamClient");
const index_1 = require("../index");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const STATIC_LOGOS = {
    'ETH': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    'SOL': 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
    'USDC': 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
    'JUP': 'https://assets.coingecko.com/coins/images/34188/small/jup.png',
    'BTC': 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
    'BNB': 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
    'ARB': 'https://assets.coingecko.com/coins/images/16547/small/arb.png',
    'MATIC': 'https://assets.coingecko.com/coins/images/4713/small/polygon.png'
};
const CHAIN_LOGOS = {
    'EVM': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
    'SOLANA': 'https://assets.coingecko.com/coins/images/4128/small/solana.png'
};
const priceCache = {};
const CACHE_TTL = 60000;
class PortfolioService {
    // In-memory portfolio cache — shared between dashboard polling and AI node commands
    static cachedPortfolio = null;
    static portfolioCacheTimestamp = 0;
    static PORTFOLIO_CACHE_TTL = 60_000; // 60s
    /**
     * Fetch aggregated portfolio via Backend Team secure proxy.
     * Uses stale-while-revalidate: returns cached data immediately if available,
     * then refreshes in the background. Only blocks on first fetch.
     */
    static async getAggregatedPortfolio(wallets) {
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
    static revalidatePromise = null;
    static async revalidatePortfolio(wallets) {
        // Deduplicate concurrent revalidation requests
        if (this.revalidatePromise)
            return this.revalidatePromise;
        this.revalidatePromise = (async () => {
            try {
                const portfolio = await BackendTeamClient_1.backendTeamClient.getPortfolio(wallets);
                this.cachedPortfolio = portfolio;
                this.portfolioCacheTimestamp = Date.now();
                return portfolio;
            }
            catch (error) {
                // BackendTeamClient already logs the error — just return cached/empty data
                if (this.cachedPortfolio)
                    return this.cachedPortfolio;
                return { assets: [], totalValue: 0, totalChange24h: 0, growthValue: 0 };
            }
            finally {
                this.revalidatePromise = null;
            }
        })();
        return this.revalidatePromise;
    }
    /**
     * Fetch real prices from CoinGecko with 5min caching
     * Returns cached prices if API fails, but logs warnings for stale data
     */
    static async getPrices(ids = ['ethereum', 'solana']) {
        const now = Date.now();
        const results = {};
        const missingIds = [];
        const mapping = {
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
        if (missingIds.length === 0)
            return results;
        try {
            const idString = missingIds.join(',');
            const response = await axios_1.default.get(`https://api.coingecko.com/api/v3/simple/price?ids=${idString}&vs_currencies=usd`, {
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
        }
        catch (err) {
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
    static async getRecentTransactions(wallets) {
        // Always try remote first for fresh, correctly-converted data
        try {
            const remoteTxs = await BackendTeamClient_1.backendTeamClient.getTransactions(wallets);
            if (remoteTxs && remoteTxs.length > 0) {
                // Persist to local cache (fire-and-forget, for offline fallback)
                for (const tx of remoteTxs) {
                    index_1.db.insert(schema_1.transactions).values({
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
                        target: schema_1.transactions.signature,
                        set: {
                            status: tx.status,
                            amount: tx.amount?.toString() || '0',
                            walletAddress: tx.walletAddress || tx.wallet || '',
                            label: tx.label,
                            rawData: JSON.stringify(tx),
                        }
                    }).catch(() => { });
                }
                return remoteTxs.map((tx) => ({
                    ...tx,
                    logo: STATIC_LOGOS[tx.symbol] || tx.logo
                }));
            }
        }
        catch (error) {
            console.error('[PortfolioService] Remote tx fetch failed, falling back to cache:', error.message);
        }
        // Fallback: read from local cache only if remote fails
        try {
            const localData = await index_1.db.select()
                .from(schema_1.transactions)
                .orderBy((0, drizzle_orm_1.desc)(schema_1.transactions.timestamp))
                .limit(250);
            return localData.map(tx => {
                let extra = {};
                try {
                    extra = tx.rawData ? JSON.parse(tx.rawData) : {};
                }
                catch { }
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
                    logo: STATIC_LOGOS[tx.symbol],
                    swapDetails: extra.swapDetails,
                };
            });
        }
        catch (dbErr) {
            console.error('[PortfolioService] Local cache read failed:', dbErr);
            return [];
        }
    }
    static async getTopMarkets() {
        try {
            // Use Backend Team's curated top markets endpoint with sparklines
            const markets = await BackendTeamClient_1.backendTeamClient.getTopMarkets(20);
            // Transform to expected format
            return markets.map((market) => ({
                symbol: market.symbol,
                name: market.name,
                price: `$${market.price.toLocaleString()}`,
                change: market.change > 0 ? `+${market.change.toFixed(1)}%` : `${market.change.toFixed(1)}%`,
                isUp: market.change > 0,
                logo: market.image || STATIC_LOGOS[market.symbol]
            }));
        }
        catch (error) {
            console.error('[PortfolioService] Top markets failed:', error);
            // Minimal graceful degradation - return empty array instead of fake data
            // The UI should handle this case
            return [];
        }
    }
    /**
     * Get detailed stats for a specific asset (price, volume, mcap, etc.)
     */
    static async getAssetStats(symbol) {
        try {
            const tokenData = await BackendTeamClient_1.backendTeamClient.getTokenPrice(symbol);
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
        }
        catch (error) {
            console.error(`[PortfolioService] Failed to get stats for ${symbol}:`, error);
            return null;
        }
    }
    static async getTopMovers() { return []; }
    static cachedGlobalStats = null;
    static globalStatsTimestamp = 0;
    static async getGlobalStats() {
        const now = Date.now();
        const cacheAge = now - this.globalStatsTimestamp;
        // Use cache if less than 1 minute old (more frequent updates for global market)
        if (this.cachedGlobalStats && cacheAge < 60 * 1000) {
            return this.cachedGlobalStats;
        }
        try {
            // Fetch from Backend Team secure proxy
            const stats = await BackendTeamClient_1.backendTeamClient.getMarketGlobal();
            if (stats) {
                this.cachedGlobalStats = stats;
                this.globalStatsTimestamp = now;
                return stats;
            }
            // Fallback to minimal data if proxy fails
            if (this.cachedGlobalStats)
                return this.cachedGlobalStats;
            return null;
        }
        catch (err) {
            console.error('[PortfolioService] Global stats fetch failed:', err.message);
            return this.cachedGlobalStats || null;
        }
    }
}
exports.PortfolioService = PortfolioService;
