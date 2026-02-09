import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Wallet,
    Bot,
    Settings
} from 'lucide-react';

export const Sidebar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    return (
        <aside className="w-20 bg-[#f4f2e6] border-r border-black/5 flex flex-col items-center py-6 gap-6 z-40 shrink-0">
            {/* Logo */}
            <div className="size-10 bg-white rounded-xl flex items-center justify-center shadow-soft border border-white">
                <span className="material-symbols-outlined text-primary text-2xl font-bold">token</span>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-4 mt-4">
                <NavButton
                    icon={<LayoutDashboard size={20} />}
                    active={isActive('/')}
                    onClick={() => navigate('/')}
                />
                <NavButton
                    icon={<Wallet size={20} />}
                    active={isActive('/wallet')}
                    onClick={() => navigate('/wallet')}
                />
                <NavButton
                    icon={<Bot size={20} />}
                    active={isActive('/chat')}
                    onClick={() => navigate('/chat')}
                />
                <NavButton
                    icon={<Settings size={20} />}
                    active={isActive('/settings')}
                    onClick={() => navigate('/settings')}
                />
            </nav>

            {/* User Profile */}
            <div className="mt-auto flex flex-col items-center gap-4">
                <div
                    className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border-2 border-white shadow-md relative group cursor-pointer"
                    style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDRbhgyUn6jkW20dDOnMpH_1-jPlYOa9Zl1YeFV9bYc4MUus5PTlyqty73mOkBOGSlc5xFq1dorT5OLlELpT-8b73OvnHS1jiMs8BwIQ--bV-YL-IS_kwsKx_eSIv0sEZ-wn022kvrUq1v7pe7MFjtsWlryPULlmLs0yBlDjzbly_UW9_WVLnOhCB9ZhSLOiY8FCGK1_ozB7KiBAJe4h-ZsCWP_12tEOiVAVfkTo_rJlA1ya86XNG0LAXBuZP4oLPdehoFs-D4AQFc")' }}
                >
                    <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>
            </div>
        </aside>
    );
};

interface NavButtonProps {
    icon: React.ReactNode;
    active: boolean;
    onClick: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ icon, active, onClick }) => (
    <button
        onClick={onClick}
        className={`
            size-10 rounded-lg flex items-center justify-center transition-all
            ${active
                ? 'bg-primary text-white shadow-button hover:bg-primary/90'
                : 'bg-white text-text-muted shadow-soft border border-white hover:text-primary'
            }
        `}
    >
        {icon}
    </button>
);
