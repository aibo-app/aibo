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
    address?: string;
}

export interface PortfolioData {
    assets: Asset[];
    totalValue: number;
    totalChange24h: number;
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
    swapDetails?: {
        otherAmount: number;
        otherSymbol: string;
    };
    wallet?: string;
}

export interface GlobalStats {
    marketCap: number;
    volume: number; // Changed from volume24h
    btcDominance: number;
    gasPrice: number;
}

export interface MarketTrend {
    id: string;
    symbol: string;
    name: string;
    price: number;
    change: number; // Changed from change24h
    history: number[]; // Changed from sparkline
    image?: string;
}

export interface TopMover {
    id: string;
    symbol: string;
    change: number; // Changed from change24h
    type: 'gainer' | 'loser';
    price: number;
    image?: string;
}

export type Page = 'dashboard' | 'wallet' | 'asset' | 'settings' | 'assistant' | 'onboarding' | 'activity' | 'transaction' | 'chat';

export interface Wallet {
    address: string;
    label: string;
    name?: string; // Dashboard expects name or label?
    chainType: 'evm' | 'solana' | 'SOLANA'; // Handle case sensitivity if any
}
