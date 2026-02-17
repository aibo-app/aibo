import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel, SectionTitle } from '../components/ui/Panel';
import { useData } from '../hooks/useData';
import { Logo } from '../components/common/Logo';

const APP_VERSION = '0.1.0';

const isMac = navigator.platform.toUpperCase().includes('MAC');
const mod = isMac ? '⌘' : 'Ctrl';

const FEATURES = [
    { icon: 'mic', title: 'Voice Assistant', desc: 'Talk to Aibo with natural voice commands', color: 'bg-purple-100 text-purple-600' },
    { icon: 'account_balance_wallet', title: 'Portfolio Tracker', desc: 'Track holdings across multiple wallets', color: 'bg-blue-100 text-blue-600' },
    { icon: 'psychology', title: 'AI Brain', desc: 'Powered by DeepSeek via OpenClaw gateway', color: 'bg-amber-100 text-amber-600' },
    { icon: 'chat', title: 'Chat', desc: 'Text conversations with context memory', color: 'bg-green-100 text-green-600' },
    { icon: 'share', title: 'Social Channels', desc: 'Connect Telegram, Discord, and more', color: 'bg-pink-100 text-pink-600' },
    { icon: 'extension', title: 'Skills', desc: 'Extensible skill system for custom actions', color: 'bg-indigo-100 text-indigo-600' },
    { icon: 'rule', title: 'Rules', desc: 'Automated rules engine for alerts and actions', color: 'bg-teal-100 text-teal-600' },
    { icon: 'notifications_active', title: 'Alerts', desc: 'Real-time notifications on price moves', color: 'bg-red-100 text-red-600' },
    { icon: 'trending_up', title: 'Market Intel', desc: 'Trending tokens, new launches, alpha feed', color: 'bg-cyan-100 text-cyan-600' },
];

const SHORTCUTS = [
    { keys: [mod, 'K'], label: 'Quick search' },
    { keys: [mod, 'N'], label: 'New conversation' },
    { keys: [mod, ','], label: 'Open settings' },
    { keys: [mod, '/'], label: 'Toggle sidebar' },
    { keys: ['Space'], label: 'Push-to-talk (hold)' },
    { keys: ['Esc'], label: 'Close popup / cancel' },
];

const QUICK_LINKS = [
    { icon: 'forum', title: 'Discord Community', desc: 'Join our community for help', url: 'https://discord.gg/aibo' },
    { icon: 'code', title: 'GitHub Repository', desc: 'View source and report bugs', url: 'https://github.com/fortuneofweb3/aiboapp' },
    { icon: 'menu_book', title: 'Documentation', desc: 'Guides and API reference', url: 'https://docs.aibo.app' },
    { icon: 'feedback', title: 'Send Feedback', desc: 'Help us improve Aibo', url: 'https://github.com/fortuneofweb3/aiboapp/issues' },
];

export const HelpPage: React.FC = () => {
    const { openClawStatus, wallets, portfolioData } = useData();

    // Fix for strict checks on navigator.platform in some environments
    const platform = isMac ? 'macOS' : (navigator?.platform?.includes('Win') ? 'Windows' : 'Linux');

    return (
        <div className="flex-1 flex flex-col p-8 overflow-y-auto bg-beige custom-scrollbar pb-10">
            <PageHeader
                title="Help & About"
                subtitle="Everything you need to know about Aibo"
            />

            {/* Hero Welcome Banner */}
            <Panel className="py-12 px-10 bg-white shadow-sm mb-8 relative overflow-hidden shrink-0">
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: 'radial-gradient(circle, #2c5bf6 1px, transparent 1px)',
                        backgroundSize: '24px 24px',
                    }}
                />
                <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">
                    <div className="size-20 md:size-24 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 shadow-inner">
                        <Logo className="w-10 h-10 md:w-14 md:h-14 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-3xl md:text-4xl font-bold text-text-main font-display tracking-tight break-words">
                            Welcome to Aibo
                        </h2>
                        <p className="text-sm md:text-base text-text-muted font-medium mt-3 leading-relaxed break-words">
                            Your AI-powered crypto companion. Track portfolios, chat with your assistant,
                            set up automated rules, and stay ahead of the market — all from one place.
                        </p>
                    </div>
                </div>
            </Panel>

            {/* Feature Overview */}
            <div className="mb-8">
                <SectionTitle title="Features" icon="apps" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
                    {FEATURES.map((f) => (
                        <div
                            key={f.title}
                            className="flex items-start gap-4 p-5 rounded-xl bg-white border border-black/5 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className={`size-12 rounded-xl flex items-center justify-center shrink-0 ${f.color}`}>
                                <span className="material-symbols-outlined text-2xl">{f.icon}</span>
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-base font-bold text-text-main tracking-tight mb-1">{f.title}</h4>
                                <p className="text-sm text-text-muted/80 font-medium leading-relaxed">{f.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Two-column layout for clearer separation */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
                {/* Keyboard Shortcuts */}
                <Panel className="p-8 bg-white shadow-sm h-full">
                    <SectionTitle title="Keyboard Shortcuts" icon="keyboard" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        {SHORTCUTS.map((s) => (
                            <div key={s.label} className="flex items-center justify-between gap-3 p-4 bg-gray-50 rounded-xl border border-black/5">
                                <span className="text-sm font-medium text-text-main">{s.label}</span>
                                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                                    {s.keys.map((k, i) => (
                                        <React.Fragment key={k}>
                                            {i > 0 && <span className="text-xs text-text-muted/40 font-bold">+</span>}
                                            <kbd className="bg-white border border-black/10 rounded-lg px-2 py-1 text-xs font-mono font-bold text-text-main shadow-sm min-w-[20px] text-center">
                                                {k}
                                            </kbd>
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </Panel>

                {/* System Diagnostics */}
                <Panel className="p-8 bg-white shadow-sm h-full">
                    <SectionTitle title="System Diagnostics" icon="monitor_heart" />
                    <div className="space-y-4 mt-6">
                        <DiagRow
                            label="Brain Gateway"
                            status={openClawStatus ? 'ok' : 'error'}
                            value={openClawStatus ? 'Connected' : 'Disconnected'}
                        />
                        <DiagRow
                            label="Backend Server"
                            status="ok"
                            value="Online"
                        />
                        <DiagRow
                            label="Tracked Wallets" // Simplified label
                            value={`${wallets.length} active`}
                        />
                        <DiagRow
                            label="Portfolio Value"
                            value={portfolioData?.totalValue != null
                                ? `$${portfolioData.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : '—'}
                        />
                    </div>
                </Panel>
            </div>

            {/* Two-column: Quick Links + System Info */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Quick Links */}
                <Panel className="p-8 bg-white shadow-sm h-full">
                    <SectionTitle title="Quick Links" icon="link" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 auto-rows-fr">
                        {QUICK_LINKS.map((link) => (
                            <button
                                key={link.title}
                                onClick={() => window.open(link.url, '_blank')}
                                className="flex items-start gap-4 p-5 rounded-xl bg-gray-50/50 border border-black/5 text-left hover:bg-gray-50 transition-colors cursor-pointer h-full group"
                            >
                                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-xl text-primary">{link.icon}</span>
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-sm font-bold text-text-main tracking-tight mb-1">{link.title}</h4>
                                    <p className="text-xs text-text-muted/80 font-medium leading-relaxed">{link.desc}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </Panel>

                {/* System Info */}
                <Panel className="p-8 bg-white shadow-sm h-full">
                    <SectionTitle title="System Info" icon="info" />
                    <div className="space-y-3 mt-6">
                        {[
                            ['Version', `v${APP_VERSION}`],
                            ['Runtime', 'Electron + Node 22'],
                            ['AI Protocol', 'OpenClaw v3'],
                            ['Platform', platform],
                            ['Supported Chains', 'Solana'],
                            ['AI Gateway', 'DeepSeek V3'],
                        ].map(([label, value]) => (
                            <div key={label} className="flex justify-between text-xs font-medium py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 px-2 rounded-lg -mx-2 transition-colors">
                                <span className="text-text-muted">{label}</span>
                                <span className="text-text-main font-mono">{value}</span>
                            </div>
                        ))}
                    </div>
                </Panel>
            </div>
        </div>
    );
};

const DiagRow: React.FC<{
    label: string;
    value: string;
    status?: 'ok' | 'error';
}> = ({ label, value, status }) => (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-black/5">
        <span className="text-sm font-semibold text-text-main uppercase tracking-wider">{label}</span>
        <span className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${status === 'ok' ? 'text-green-600' : status === 'error' ? 'text-red-500' : 'text-text-main'
            }`}>
            {status && (
                <span className={`size-2 rounded-full ${status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`} />
            )}
            {value}
        </span>
    </div>
);
