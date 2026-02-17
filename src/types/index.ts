export interface Asset {
    symbol: string;
    balance: number;
    value: number;
    price: number;
    change: number; // Changed from change24h
    name: string;
    isStaked?: boolean;
    history?: number[];
    logo?: string;
    type?: 'evm' | 'solana';
    chain?: 'EVM' | 'SOLANA';
    address?: string;
    chainLogo?: string;
    walletAddress?: string; // Source wallet that owns this asset
}

export interface PortfolioData {
    assets: Asset[];
    totalValue: number;
    totalChange24h: number;
    growthValue?: number;
}

export interface Transaction {
    id: string;
    type: string;
    symbol: string;
    amount: number;
    value: number;
    status: string;
    time: string;
    hash?: string;
    label?: string;
    signature?: string;
    logo?: string;
    swapDetails?: {
        otherAmount: number;
        otherSymbol: string;
    };
    wallet?: string;
    walletAddress?: string;
    chain?: 'EVM' | 'SOLANA';
}

export interface GlobalStats {
    marketCap: number;
    volume: number;
    btcDominance: number;
    gasPrice: number;
    sentiment?: {
        value: number;
        label: string;
    };
}

export interface MarketTrend {
    id: string;
    symbol: string;
    name: string;
    price: string | number;
    change: string | number;
    history?: number[];
    image?: string;
    logo?: string;
    isUp?: boolean;
}

export interface TopMover {
    id: string;
    symbol: string;
    change: number; // Changed from change24h
    type: 'gainer' | 'loser';
    price: number;
    image?: string;
}

export interface AlphaToken {
    address: string;
    name: string;
    symbol: string;
    logo?: string;
    price: number;
    liquidity: number;
    volume24h: number;
    mcap: number;
    priceChange24h: number;
    createdAt: number;
    dex: string;
    chain?: 'base' | 'solana';
    launchpadDetected?: string;
    trendingScore?: number;
}

export interface AlphaData {
    trending: AlphaToken[];
    clanker: AlphaToken[];
    virtuals: AlphaToken[];
}

export type Page = 'dashboard' | 'wallet' | 'asset' | 'settings' | 'assistant' | 'onboarding' | 'activity' | 'transaction' | 'chat';

export interface Wallet {
    address: string;
    label: string;
    name?: string;
    chainType: 'evm' | 'solana';
    logo?: string;
    chainLogo?: string;
}

export interface AgentAction {
    action: string;
    data?: Record<string, unknown>;
    type?: string;
}
