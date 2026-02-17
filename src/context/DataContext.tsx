import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { PortfolioData, Transaction, GlobalStats, MarketTrend, TopMover, Wallet, AgentAction, AlphaData } from '../types';
import { DataContext, type Alert } from '../hooks/useData';
import { useTheme } from '../hooks/useTheme';
import { ToastContainer, useToast } from '../components/common/Toast';
import { API_BASE, WS_BASE } from '../lib/api';
import { POLLING_INTERVALS, TIMEOUTS } from '../lib/constants';
import { createLogger } from '../utils/logger';

const log = createLogger('DataContext');

// Cache helpers
const CACHE_KEY = 'aibo_data_cache';
const loadCache = () => {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        return cached ? JSON.parse(cached) : null;
    } catch {
        return null;
    }
};

const saveCache = (data: any) => {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
        // Ignore cache errors
    }
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    console.log('🎨 [React] DataProvider mounting...');
    console.time('[React] Initial render');

    // Load from cache immediately for instant startup
    const cachedData = loadCache();
    if (cachedData) {
        console.log('💾 [React] Loaded cached data from previous session');
    }

    const [portfolioData, setPortfolioData] = useState<PortfolioData>(cachedData?.portfolioData || { assets: [], totalValue: 0, totalChange24h: 0 });
    const [transactions, setTransactions] = useState<Transaction[]>(cachedData?.transactions || []);
    const [globalStats, setGlobalStats] = useState<GlobalStats | null>(cachedData?.globalStats || null);
    const [marketTrends, setMarketTrends] = useState<MarketTrend[]>(cachedData?.marketTrends || []);
    const [topMovers, setTopMovers] = useState<TopMover[]>(cachedData?.topMovers || []);
    const [wallets, setWallets] = useState<Wallet[]>(cachedData?.wallets || []);
    const [alerts, setAlerts] = useState<Alert[]>(cachedData?.alerts || []);
    const [alphaData, setAlphaData] = useState<AlphaData>(cachedData?.alphaData || { trending: [], clanker: [], virtuals: [] });
    const [openClawStatus, setOpenClawStatus] = useState(false);
    const [agentAction, setAgentAction] = useState<AgentAction | null>(null);
    const [loading, setLoading] = useState(true); // Start true to prevent premature redirects
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);
    const [activePage, setActivePage] = useState('dashboard');
    const { theme } = useTheme();
    const [ws, setWs] = useState<WebSocket | null>(null);
    const { toasts, showToast, removeToast } = useToast();
    const previousOpenClawStatus = useRef<boolean | null>(null);

    // Fetch with timeout — prevents one slow endpoint from blocking the UI
    // Super aggressive timeout for instant feedback
    const fetchWithTimeout = useCallback((url: string, timeoutMs = 1000) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
    }, []);

    const retryCountRef = useRef(0);
    const hasPortfolioData = useRef(false);

    const fetchData = useCallback(async () => {
        // Progressive loading: each fetch updates state independently as it resolves.
        // One slow/failing endpoint no longer blocks everything else.
        let anySuccess = false;
        let gotPortfolio = false;
        const track = (p: Promise<Response>) => p.then(async r => { if (r.ok) anySuccess = true; return r; });

        const fetches = [
            track(fetchWithTimeout(`${API_BASE}/api/portfolio`)).then(async r => {
                if (r.ok) {
                    const data = await r.json();
                    if (data.totalValue > 0) {
                        gotPortfolio = true;
                        hasPortfolioData.current = true;
                    }
                    setPortfolioData(data);
                }
            }),
            track(fetchWithTimeout(`${API_BASE}/api/transactions`)).then(async r => {
                if (r.ok) setTransactions(await r.json());
            }),
            track(fetchWithTimeout(`${API_BASE}/api/global`)).then(async r => {
                if (r.ok) setGlobalStats(await r.json());
            }),
            track(fetchWithTimeout(`${API_BASE}/api/market/trends`)).then(async r => {
                if (r.ok) setMarketTrends(await r.json());
            }),
            track(fetchWithTimeout(`${API_BASE}/api/market/movers`)).then(async r => {
                if (r.ok) setTopMovers(await r.json());
            }),
            track(fetchWithTimeout(`${API_BASE}/api/wallets`, 5000)).then(async r => {
                if (r.ok) setWallets(await r.json());
            }),
            track(fetchWithTimeout(`${API_BASE}/api/alerts?limit=10`, 5000)).then(async r => {
                if (r.ok) {
                    const data = await r.json();
                    setAlerts(data.alerts || []);
                }
            }),
            track(fetchWithTimeout(`${API_BASE}/api/discovery/alpha`)).then(async r => {
                if (r.ok) setAlphaData(await r.json());
            }),
        ];

        // allSettled — never rejects, each fetch succeeds/fails independently
        await Promise.allSettled(fetches);

        // After first attempt, mark initial load complete so UI can render
        if (!initialLoadComplete) {
            console.timeEnd('[React] Initial render');
            console.log('✅ [React] Initial load complete, UI ready to show');
            setInitialLoadComplete(true);
            setLoading(false);
        }

        if (!anySuccess && retryCountRef.current < 10) {
            // Server not up at all — retry very fast
            retryCountRef.current++;
            setTimeout(fetchData, 300);
        } else if (!gotPortfolio && !hasPortfolioData.current && retryCountRef.current < 20) {
            // Server is up but portfolio data not ready yet (backend-team still starting)
            // Poll every 5s until we get real portfolio data
            retryCountRef.current++;
            log.debug(`Waiting for portfolio data... retry ${retryCountRef.current}/20`);
            setTimeout(fetchData, 5000);
        } else {
            retryCountRef.current = 0;
        }
    }, [fetchWithTimeout]);

    useEffect(() => {
        console.log('🔄 [React] Starting data fetch...');
        fetchData();
        // Poll data every 60s (was 30s) — reduces API calls by half
        let dataInterval = setInterval(fetchData, POLLING_INTERVALS.DATA_REFRESH);

        // Check OpenClaw status — immediate + after brain startup + then every 30s
        const checkBrainStatus = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/openclaw/status`);
                if (res.ok) {
                    const data = await res.json();
                    setOpenClawStatus(data.connected);
                }
            } catch {
                setOpenClawStatus(false);
            }
        };
        checkBrainStatus(); // Immediate check on mount
        setTimeout(checkBrainStatus, 10000); // Re-check after brain has time to connect
        let statusInterval = setInterval(checkBrainStatus, POLLING_INTERVALS.STATUS_CHECK);

        // Pause polling when window is hidden to save battery
        const handleVisibility = () => {
            // Clear old intervals first to prevent duplicates
            clearInterval(dataInterval);
            clearInterval(statusInterval);

            if (!document.hidden) {
                // Resume polling when visible
                fetchData(); // Refresh immediately on return
                dataInterval = setInterval(fetchData, POLLING_INTERVALS.DATA_REFRESH);
                checkBrainStatus(); // Immediate check when tab becomes visible
                statusInterval = setInterval(checkBrainStatus, POLLING_INTERVALS.STATUS_CHECK);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        // Global WebSocket for Agent Actions & Live Updates (with auto-reconnect)
        let wsInstance: WebSocket | null = null;
        let reconnectTimer: ReturnType<typeof setTimeout>;
        let isCleaning = false;

        const connectWs = () => {
            if (isCleaning) return;
            const socket = new WebSocket(`${WS_BASE}/ws/voice`);
            wsInstance = socket;
            setWs(socket);

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'agent_action') {
                        log.debug('Received Agent Action', data);
                        setAgentAction(data);
                        setTimeout(() => setAgentAction(null), TIMEOUTS.AGENT_ACTION_DISPLAY);
                    }
                } catch {
                    // Ignore non-json or noise
                }
            };

            socket.onclose = () => {
                if (!isCleaning) {
                    log.debug('WebSocket closed, reconnecting in 3s...');
                    reconnectTimer = setTimeout(connectWs, 3000);
                }
            };

            socket.onerror = () => {
                socket.close();
            };
        };

        connectWs();

        return () => {
            isCleaning = true;
            clearInterval(dataInterval);
            clearInterval(statusInterval);
            clearTimeout(reconnectTimer);
            document.removeEventListener('visibilitychange', handleVisibility);
            wsInstance?.close();
        };
    }, []);

    // Show toast notifications when Brain connection changes
    useEffect(() => {
        if (previousOpenClawStatus.current === null) {
            // First check, don't show notification
            previousOpenClawStatus.current = openClawStatus;
            return;
        }

        if (openClawStatus !== previousOpenClawStatus.current) {
            // Don't show toasts in the assistant popup window
            const isAssistantRoute = window.location.hash.includes('/assistant');
            if (!isAssistantRoute) {
                if (openClawStatus) {
                    showToast('Brain connected successfully', 'success');
                } else {
                    showToast('Brain disconnected. Reconnecting...', 'warning');
                }
            }
            previousOpenClawStatus.current = openClawStatus;
        }
    }, [openClawStatus, showToast]);

    // Detect new alerts and fire notifications
    const previousAlertIdsRef = useRef<Set<number>>(new Set());
    const isInitialAlertLoadRef = useRef(true);

    useEffect(() => {
        if (alerts.length === 0) return;

        const currentIds = new Set(alerts.map(a => a.id));

        if (isInitialAlertLoadRef.current) {
            previousAlertIdsRef.current = currentIds;
            isInitialAlertLoadRef.current = false;
            return;
        }

        const isAssistantRoute = window.location.hash.includes('/assistant');
        const newAlerts = alerts.filter(a => !previousAlertIdsRef.current.has(a.id));

        for (const alert of newAlerts) {
            if (!isAssistantRoute) {
                showToast(`${alert.title}: ${alert.desc}`, alert.color === 'green' ? 'success' : 'warning');
            }
            window.electronAPI?.showNotification?.(
                alert.title,
                alert.desc
            );
        }

        previousAlertIdsRef.current = currentIds;
    }, [alerts, showToast]);

    // Sync activePage with the current route
    useEffect(() => {
        const syncActivePage = () => {
            const hash = window.location.hash.replace('#/', '') || 'dashboard';
            setActivePage(hash.split('/')[0] || 'dashboard');
        };
        syncActivePage();
        window.addEventListener('hashchange', syncActivePage);
        return () => window.removeEventListener('hashchange', syncActivePage);
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

    // Save to cache whenever data changes (for instant next startup)
    useEffect(() => {
        if (initialLoadComplete) {
            saveCache({
                portfolioData,
                transactions,
                globalStats,
                marketTrends,
                topMovers,
                wallets,
                alerts,
                alphaData
            });
        }
    }, [portfolioData, transactions, globalStats, marketTrends, topMovers, wallets, alerts, alphaData, initialLoadComplete]);

    const unreadAlertCount = useMemo(() => alerts.filter(a => !a.isRead).length, [alerts]);

    const markAlertRead = useCallback(async (id: number) => {
        try {
            await fetch(`${API_BASE}/api/alerts/${id}/read`, { method: 'POST' });
            setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
        } catch (err) {
            log.error('Failed to mark alert as read', err);
        }
    }, []);

    const markAllAlertsRead = useCallback(async () => {
        try {
            await fetch(`${API_BASE}/api/alerts/read-all`, { method: 'POST' });
            setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
        } catch (err) {
            log.error('Failed to mark all alerts as read', err);
        }
    }, []);

    const contextValue = useMemo(() => ({
        portfolioData,
        transactions,
        globalStats,
        marketTrends,
        topMovers,
        wallets,
        alerts,
        unreadAlertCount,
        alphaData,
        openClawStatus,
        agentAction,
        loading,
        initialLoadComplete,
        refreshData: fetchData,
        markAlertRead,
        markAllAlertsRead,
        activePage,
        setActivePage
    }), [
        portfolioData,
        transactions,
        globalStats,
        marketTrends,
        topMovers,
        wallets,
        alerts,
        unreadAlertCount,
        alphaData,
        openClawStatus,
        agentAction,
        loading,
        initialLoadComplete,
        fetchData,
        markAlertRead,
        markAllAlertsRead,
        activePage
    ]);

    return (
        <DataContext.Provider value={contextValue}>
            {children}
            <ToastContainer toasts={toasts} onClose={removeToast} />
        </DataContext.Provider>
    );
};

