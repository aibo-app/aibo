import React from 'react';
import { Sidebar } from './Sidebar';
import { Ticker } from './Ticker';

interface ShellProps {
    children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ children }) => {
    return (
        <div className="flex h-screen w-full flex-col overflow-hidden relative bg-[#ece9d8] text-text-main font-body selection:bg-primary selection:text-white">
            <Ticker />

            <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <main className="flex-1 flex flex-col overflow-hidden relative">
                    {children}
                </main>
            </div>

            {/* Global Footer */}
            <footer className="h-8 bg-[#f4f2e6] border-t border-black/5 px-6 flex items-center justify-between text-[10px] uppercase font-bold text-text-muted z-50 shrink-0">
                <div className="flex gap-6">
                    <span>System v24.3</span>
                    <span>Ledger Status: Synced</span>
                    <span className="flex items-center gap-1">
                        <span className="size-2 bg-green-500 rounded-full"></span>
                        Secure Connection
                    </span>
                </div>
                <div className="flex gap-6 items-center">
                    <div className="flex items-center gap-2">
                        <span className="size-2 bg-green-500 rounded-full"></span>
                        <span>Node Latency: 12ms</span>
                    </div>
                    <span>© 2024 Aibō Systems</span>
                </div>
            </footer>
        </div>
    );
};
