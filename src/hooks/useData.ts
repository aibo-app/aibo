import { createContext, useContext } from 'react';
import type { PortfolioData, Transaction, GlobalStats, MarketTrend, TopMover, Wallet, AgentAction, AlphaData } from '../types';

export interface Alert {
    id: number;
    icon: string;
    title: string;
    desc: string;
    color: string;
    time: string;
    isRead: boolean;
}

export interface DataContextType {
    portfolioData: PortfolioData;
    transactions: Transaction[];
    globalStats: GlobalStats | null;
    marketTrends: MarketTrend[];
    topMovers: TopMover[];
    wallets: Wallet[];
    alerts: Alert[];
    unreadAlertCount: number;
    alphaData: AlphaData;
    openClawStatus: boolean;
    agentAction: AgentAction | null;
    loading: boolean;
    initialLoadComplete: boolean;
    refreshData: () => Promise<void>;
    markAlertRead: (id: number) => Promise<void>;
    markAllAlertsRead: () => Promise<void>;
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
