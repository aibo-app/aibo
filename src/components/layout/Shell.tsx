import React from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Ticker } from './Ticker';
import { useData } from '../../hooks/useData';

export const Shell: React.FC = () => {
    const { openClawStatus, wallets, initialLoadComplete } = useData();
    const location = useLocation();

    // Auto-redirect to onboarding if no wallets and not already there
    // Wait for initial load to complete to avoid premature redirect
    if (initialLoadComplete && wallets.length === 0 && location.pathname !== '/onboarding') {
        return <Navigate to="/onboarding" replace />;
    }

    return (
        <div className="flex h-screen w-full flex-col overflow-hidden relative bg-beige text-text-main font-body selection:bg-primary selection:text-white">
            <Ticker />

            <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <main className="flex-1 flex flex-col overflow-hidden relative">
                    <Outlet />
                </main>
            </div>

            {/* Global Footer with Brain Status */}
            <footer className="h-8 bg-sidebar border-t border-black/5 px-6 flex items-center justify-between text-[10px] uppercase font-bold text-text-muted z-50 shrink-0">
                <span>Aibō OS</span>
                <div className="flex items-center gap-2">
                    <span className={`size-1.5 rounded-full ${openClawStatus ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    <span className="text-[10px]">{openClawStatus ? 'Brain Online' : 'Brain Offline'}</span>
                </div>
            </footer>
        </div>
    );
};
