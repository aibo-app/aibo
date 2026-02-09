import React, { useState, useEffect } from 'react';
import type { PortfolioData, Transaction, GlobalStats, MarketTrend, TopMover, Wallet } from '../types';
import { DataContext } from '../hooks/useData';
import { useTheme } from '../hooks/useTheme';

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [portfolioData, setPortfolioData] = useState<PortfolioData>({ assets: [], totalValue: 0, totalChange24h: 0 });
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
    const [marketTrends, setMarketTrends] = useState<MarketTrend[]>([]);
    const [topMovers, setTopMovers] = useState<TopMover[]>([]);
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [openClawStatus, setOpenClawStatus] = useState(false);
    const [agentAction, setAgentAction] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [activePage, setActivePage] = useState('dashboard');
    const { theme } = useTheme();
    const [ws, setWs] = useState<WebSocket | null>(null);

    const fetchData = async () => {
        try {
            const [portRes, txRes, globalRes, trendsRes, moversRes, walletsRes] = await Promise.all([
                fetch('http://localhost:3001/api/portfolio'),
                fetch('http://localhost:3001/api/transactions'),
                fetch('http://localhost:3001/api/global'),
                fetch('http://localhost:3001/api/market/trends'),
                fetch('http://localhost:3001/api/market/movers'),
                fetch('http://localhost:3001/api/wallets')
            ]);

            if (portRes.ok) setPortfolioData(await portRes.json());
            if (txRes.ok) setTransactions(await txRes.json());
            if (globalRes.ok) setGlobalStats(await globalRes.json());
            if (trendsRes.ok) setMarketTrends(await trendsRes.json());
            if (moversRes.ok) setTopMovers(await moversRes.json());
            if (walletsRes.ok) setWallets(await walletsRes.json());
        } catch (err) {
            console.error('Failed to fetch global data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);

        // Poll OpenClaw status
        const statusInterval = setInterval(async () => {
            try {
                const res = await fetch('http://localhost:3001/api/openclaw/status');
                if (res.ok) {
                    const data = await res.json();
                    setOpenClawStatus(data.connected);
                }
            } catch {
                setOpenClawStatus(false);
            }
        }, 5000);

        // Global WebSocket for Agent Actions & Live Updates
        const socket = new WebSocket('ws://localhost:3001/ws/voice');
        setWs(socket);

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'agent_action') {
                    console.log('🤖 [DataContext] Received Agent Action:', data);
                    setAgentAction(data);
                    // Clear action after 5 seconds
                    setTimeout(() => setAgentAction(null), 5000);
                }
            } catch (e) {
                // Ignore non-json or noise
            }
        };

        return () => {
            clearInterval(interval);
            clearInterval(statusInterval);
            socket.close();
        };
    }, []);

    // Sync state to backend for Brain context
    useEffect(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'body_state',
                state: { activePage, theme }
            }));
        }
    }, [activePage, theme, ws]);

    return (
        <DataContext.Provider value={{
            portfolioData,
            transactions,
            globalStats,
            marketTrends,
            topMovers,
            wallets,
            openClawStatus,
            agentAction,
            loading,
            refreshData: fetchData,
            activePage,
            setActivePage
        }}>
            {children}
        </DataContext.Provider>
    );
};

