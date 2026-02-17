import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Logo } from '../common/Logo';
import { useData } from '../../hooks/useData';


export const Sidebar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { unreadAlertCount } = useData();

    const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

    return (
        <aside className="w-20 bg-sidebar border-r border-black/5 flex flex-col items-center py-6 gap-6 z-40 shrink-0">
            {/* Interactive Logo */}
            <button
                onClick={() => window.electronAPI?.toggleAssistant()}
                className="w-10 h-10 hover:shadow-lg transition-all active:scale-95 cursor-pointer appearance-none bg-white rounded-xl flex items-center justify-center border border-white shadow-soft group mb-2"
                title="Toggle Aibō Assistant"
                aria-label="Toggle Aibō Assistant"
            >
                <Logo className="w-7 h-7 text-primary transition-all group-hover:scale-110" />
            </button>

            {/* Navigation */}
            <nav className="flex flex-col gap-4 mt-2">
                <NavButton
                    icon="dashboard"
                    label="Dashboard"
                    active={isActive('/')}
                    onClick={() => navigate('/')}
                    badge={unreadAlertCount}
                />
                <NavButton
                    icon="history"
                    label="Activity History"
                    active={isActive('/activity')}
                    onClick={() => navigate('/activity')}
                />
                <NavButton
                    icon="account_balance_wallet"
                    label="Wallets"
                    active={isActive('/wallet')}
                    onClick={() => navigate('/wallet')}
                />
                <NavButton
                    icon="chat_bubble"
                    label="Chat"
                    active={isActive('/chat')}
                    onClick={() => navigate('/chat')}
                />
                <NavButton
                    icon="extension"
                    label="Skills"
                    active={isActive('/skills')}
                    onClick={() => navigate('/skills')}
                />
                <NavButton
                    icon="gavel"
                    label="Rules"
                    active={isActive('/rules')}
                    onClick={() => navigate('/rules')}
                />
            </nav>

            {/* Bottom: Settings + Help */}
            <div className="mt-auto flex flex-col items-center gap-4">
                <NavButton
                    icon="settings"
                    label="Settings"
                    active={isActive('/settings')}
                    onClick={() => navigate('/settings')}
                />
                <NavButton
                    icon="help"
                    label="Help"
                    active={isActive('/help')}
                    onClick={() => navigate('/help')}
                />
            </div>
        </aside>
    );
};

interface NavButtonProps {
    icon: string;
    active: boolean;
    onClick: () => void;
    label?: string;
    badge?: number;
}

const NavButton: React.FC<NavButtonProps> = ({ icon, active, onClick, label, badge }) => (
    <button
        onClick={onClick}
        aria-label={label || icon}
        className={`
            relative size-10 rounded-lg flex items-center justify-center
            ${active
                ? 'bg-primary text-white shadow-button translate-y-px'
                : 'btn-bevel text-text-muted hover:text-primary'
            }
        `}
    >
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
        {!!badge && badge > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none shadow-sm border-2 border-sidebar">
                {badge > 9 ? '9+' : badge}
            </span>
        )}
    </button>
);
