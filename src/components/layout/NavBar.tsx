import {
    LayoutDashboard,
    Wallet as WalletIcon,
    MessageSquare,
    Settings,
    Zap, // For Brain Link
} from 'lucide-react';

import { useData } from '../../hooks/useData';

import type { Page } from '../../types';

interface NavBarProps {
    activePage: string;
    onNavigate: (page: Page) => void;
}

export const NavBar = ({ activePage, onNavigate }: NavBarProps) => {
    const { openClawStatus } = useData();

    const navItems = [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { id: 'wallet', icon: WalletIcon, label: 'Wallet' },
        { id: 'chat', icon: MessageSquare, label: 'AI Chat' },
        { id: 'settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <nav className="app-navbar">
            {/* Branding Anchor */}
            <div
                className="flex-row items-center justify-center cursor-pointer transition-transform hover:scale-110 mb-6 no-drag"
                onClick={() => window.electronAPI?.toggleAssistant()}
            >
                <img
                    src="./icon.png"
                    alt="Aibō Logo"
                    className="w-7 h-7 object-contain"
                    style={{
                        filter: 'var(--logo-filter) var(--logo-glow)'
                    }}
                />
            </div>

            {/* Navigation Items */}
            <div className="flex-col items-center gap-3">
                {navItems.map(item => {
                    const isActive = activePage === item.id;
                    return (
                        <div
                            key={item.id}
                            className={`nav-tab w-10 h-10 flex-row items-center justify-center cursor-pointer transition-all ${isActive ? 'panel-inset text-accent' : 'opacity-40 hover:opacity-100 text-secondary'}`}
                            onClick={() => onNavigate(item.id as Page)}
                        >
                            <item.icon size={20} strokeWidth={isActive ? 2.5 : 2.0} />
                        </div>
                    );
                })}
            </div>

            {/* SPACER */}
            <div style={{ flex: 1 }} />

            {/* BRAIN LINK STATUS */}
            <div
                className={`flex items-center justify-center transition-all duration-500 mb-6 ${openClawStatus ? 'opacity-100' : 'opacity-30 grayscale'}`}
                title={openClawStatus ? "OpenClaw Brain Connected" : "Brain Disconnected"}
            >
                <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${openClawStatus ? 'bg-accent-alpha border border-accent shadow-[0_0_10px_var(--accent)]' : 'border border-bevel-shadow'}`}
                >
                    <Zap size={16} fill={openClawStatus ? "currentColor" : "none"} className={openClawStatus ? "text-accent animate-pulse" : "text-muted"} />
                </div>
            </div>
        </nav>
    );
};
