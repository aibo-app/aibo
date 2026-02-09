import axios from 'axios';

// The URL of our secure Team Backend
const TEAM_BACKEND_URL = process.env.TEAM_BACKEND_URL || 'http://localhost:4000';

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
    /**
     * Fetch aggregated portfolio via Team Backend
     */
    static async getAggregatedPortfolio(wallets: { address: string; chainType: 'evm' | 'solana' }[]): Promise<any> {
        try {
            console.log(`📡 [PortfolioService] Fetching via Team Backend: ${TEAM_BACKEND_URL}/v1/portfolio`);
            const response = await axios.post(`${TEAM_BACKEND_URL}/v1/portfolio`, { wallets });
            return response.data;
        } catch (error: any) {
            console.error('[PortfolioService] Team Proxy failed:', error.message);
            return { assets: [], totalValue: 0, totalChange24h: 0 };
        }
    }

    /**
     * Fetch asset stats via Team Backend
     */
    static async getAssetStats(symbolOrId: string): Promise<any> {
        // This will be called for mascot data - keeping it local for now or proxying
        // Simulating for now
        return null;
    }

    /**
     * Stub for getPrices (Proxies to Team Backend if available, or returns empty)
     */
    static async getPrices(symbols: string[]): Promise<Record<string, number>> {
        // TODO: Implement proxy to TEAM_BACKEND/v1/prices if needed
        return {};
    }

    /**
     * Proxies to Team Backend (Stubs or real calls)
     */
    static async getRecentTransactions(wallets: any[]): Promise<BackendTransaction[]> {
        try {
            const response = await axios.post(`${TEAM_BACKEND_URL}/v1/transactions`, { wallets });
            return response.data;
        } catch { return []; }
    }

    static async getTopMarkets() {
        try {
            // 1. Try Team Backend
            const response = await axios.get(`${TEAM_BACKEND_URL}/v1/markets/top`, { timeout: 2000 });
            return response.data;
        } catch (e) {
            // 2. Fallback to CoinGecko (Public API)
            try {
                console.log('⚠️ [PortfolioService] Team Backend unavailable, fetching from CoinGecko...');
                const cgResponse = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
                    params: {
                        vs_currency: 'usd',
                        order: 'market_cap_desc',
                        per_page: 20,
                        page: 1,
                        sparkline: false
                    },
                    timeout: 5000
                });

                return cgResponse.data.map((coin: any) => ({
                    symbol: coin.symbol.toUpperCase(),
                    price: `$${coin.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    change: `${coin.price_change_percentage_24h > 0 ? '+' : ''}${coin.price_change_percentage_24h.toFixed(1)}%`,
                    isUp: coin.price_change_percentage_24h >= 0
                }));
            } catch (cgError) {
                // 3. Fallback to Mock Data
                console.warn('⚠️ [PortfolioService] External APIs unavailable, using backup data.');
                return [
                    { symbol: 'BTC', price: '$68,420.50', change: '+2.1%', isUp: true },
                    { symbol: 'ETH', price: '$3,510.12', change: '+1.4%', isUp: true },
                    { symbol: 'SOL', price: '$148.89', change: '+4.2%', isUp: true },
                    { symbol: 'BNB', price: '$598.45', change: '-0.3%', isUp: false },
                    { symbol: 'ADA', price: '$0.45', change: '-1.1%', isUp: false },
                    { symbol: 'DOT', price: '$7.12', change: '+2.5%', isUp: true },
                    { symbol: 'XRP', price: '$0.62', change: '-0.8%', isUp: false },
                    { symbol: 'DOGE', price: '$0.18', change: '+5.5%', isUp: true },
                    { symbol: 'AVAX', price: '$45.20', change: '+1.2%', isUp: true },
                    { symbol: 'LINK', price: '$18.50', change: '-1.5%', isUp: false },
                ];
            }
        }
    }

    static async getTopMovers() { return []; }
    static async getGlobalStats() { return {}; }
}
