import { createContext, useContext } from 'react';
import type { PortfolioData, Transaction, GlobalStats, MarketTrend, TopMover, Wallet } from '../types';

export interface DataContextType {
    portfolioData: PortfolioData;
    transactions: Transaction[];
    globalStats: GlobalStats | null;
    marketTrends: MarketTrend[];
    topMovers: TopMover[];
    wallets: Wallet[];
    openClawStatus: boolean;
    agentAction: any | null;
    loading: boolean;
    refreshData: () => Promise<void>;
    activePage: string;
    setActivePage: (page: string) => void;
}

export const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};
