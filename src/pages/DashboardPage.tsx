import React, { useMemo } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel, SectionTitle } from '../components/ui/Panel';
import { useData } from '../hooks/useData';
import { AlphaFeed } from '../components/dashboard/AlphaFeed';

export const DashboardPage: React.FC = () => {
    const { portfolioData, wallets, globalStats, alerts, unreadAlertCount, markAlertRead, markAllAlertsRead, openClawStatus, loading } = useData();

    const formattedNetworth = useMemo(() => {
        const val = portfolioData.totalValue.toString().split('.');
        return {
            whole: new Intl.NumberFormat('en-US').format(parseInt(val[0])),
            decimal: val[1] ? `.${val[1].padEnd(2, '0').slice(0, 2)}` : '.00'
        };
    }, [portfolioData.totalValue]);

    const allocation = useMemo(() => {
        const total = portfolioData.totalValue || 1;
        const baseVal = portfolioData.assets.filter(a => a.chain === 'EVM').reduce((sum, a) => sum + a.value, 0);
        const solVal = portfolioData.assets.filter(a => a.chain === 'SOLANA').reduce((sum, a) => sum + a.value, 0);
        return {
            base: (baseVal / total * 100).toFixed(1),
            sol: (solVal / total * 100).toFixed(1)
        };
    }, [portfolioData]);

    return (
        <div className="flex-1 flex flex-col p-8 overflow-hidden bg-beige h-full">
            <PageHeader
                title="Dashboard"
                subtitle="Central intelligence and asset overview."
            />

            <div className="flex-1 flex flex-col gap-6 min-h-0">
                {/* Top Hero Stat */}
                <section className="grid grid-cols-1 lg:grid-cols-4 gap-6 shrink-0">
                    <Panel className="lg:col-span-3 p-8 relative overflow-hidden flex flex-col justify-center bg-white min-h-[170px] shadow-sm">
                        {/* Technical Grid Texture */}
                        <div className="absolute inset-0 opacity-10 pointer-events-none"
                            style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
                        </div>

                        {/* Background Icon */}
                        <div className="absolute -right-12 -bottom-12 text-primary/5 select-none pointer-events-none z-0">
                            <svg className="w-80 h-80" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M4 10v7h3v-7H4zm6 0v7h3v-7h-3zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z" />
                            </svg>
                        </div>

                        <div className="relative z-10">
                            <p className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold mb-2 flex items-center gap-2">
                                <span className="size-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(44,91,246,0.5)]"></span>
                                Total Networth
                            </p>
                            {loading ? (
                                <div className="h-20 w-80 bg-gray-100 rounded-lg animate-pulse" />
                            ) : (
                                <h3 className="text-8xl font-bold tracking-tighter text-text-main font-display leading-none">
                                    ${formattedNetworth.whole}<span className="text-text-muted/30 text-5xl align-top ml-1">{formattedNetworth.decimal}</span>
                                </h3>
                            )}
                            <div className="flex items-center gap-4 mt-6">
                                {loading ? (
                                    <div className="h-7 w-32 bg-gray-100 rounded-lg animate-pulse" />
                                ) : (
                                    <span className={`px-3 py-1 ${portfolioData.totalChange24h >= 0 ? 'bg-green-500/20 border-green-500/30 text-green-700' : 'bg-red-500/20 border-red-500/30 text-red-700'} border text-xs font-semibold uppercase tracking-widest rounded-lg shadow-sm`}>
                                        {portfolioData.totalChange24h >= 0 ? '↑' : '↓'} {Math.abs(portfolioData.totalChange24h)}% Growth
                                    </span>
                                )}
                                <span className="text-text-muted text-xs font-semibold uppercase tracking-widest opacity-60">{wallets.length} Wallets Tracked</span>
                            </div>
                        </div>
                    </Panel>

                    <div className="grid grid-rows-3 gap-6 h-full">
                        <Panel className="bg-white px-5 py-2 flex flex-col justify-center border-black/5 shadow-sm">
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-[10px] uppercase font-semibold text-text-muted tracking-widest leading-none">Gas Price</p>
                                {globalStats ? (
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border leading-none uppercase tracking-widest ${globalStats.gasPrice > 30 ? 'text-red-600 bg-red-500/10 border-red-500/20' : 'text-green-600 bg-green-500/10 border-green-500/20'}`}>
                                        {globalStats.gasPrice > 30 ? 'CONGESTED' : 'OPTIMAL'}
                                    </span>
                                ) : (
                                    <div className="h-4 w-14 bg-gray-100 rounded-lg animate-pulse" />
                                )}
                            </div>
                            {globalStats ? (
                                <p className="text-base font-bold text-text-main font-display tracking-tight leading-none">{globalStats.gasPrice} Gwei</p>
                            ) : (
                                <div className="h-5 w-20 bg-gray-100 rounded-sm animate-pulse" />
                            )}
                        </Panel>
                        <Panel className="bg-white px-5 py-2 flex flex-col justify-center border-black/5 shadow-sm">
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-[10px] uppercase font-semibold text-text-muted tracking-widest leading-none">Sentiment</p>
                                {globalStats?.sentiment ? (
                                    <span className="text-primary text-[10px] font-semibold bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10 leading-none">{globalStats.sentiment.value}/100</span>
                                ) : (
                                    <div className="h-4 w-12 bg-gray-100 rounded-lg animate-pulse" />
                                )}
                            </div>
                            {globalStats?.sentiment ? (
                                <p className="text-base font-bold text-primary font-display uppercase tracking-tight leading-none truncate">{globalStats.sentiment.label}</p>
                            ) : (
                                <div className="h-5 w-28 bg-gray-100 rounded-sm animate-pulse" />
                            )}
                        </Panel>
                        <Panel className="bg-white px-5 py-2 flex flex-col justify-center border-black/5 shadow-sm">
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-[10px] uppercase font-semibold text-text-muted tracking-widest leading-none">Aibō Link</p>
                                <span className={`text-[10px] font-semibold uppercase tracking-widest leading-none px-2 py-0.5 rounded-lg border ${openClawStatus ? 'text-green-700 bg-green-500/10 border-green-500/20' : 'text-red-700 bg-red-500/10 border-red-500/20'}`}>
                                    {openClawStatus ? 'Active' : 'Offline'}
                                </span>
                            </div>
                            <p className="text-base font-bold text-text-main font-display tracking-tight leading-none">Brain Gateway</p>
                        </Panel>
                    </div>
                </section>

                {/* Widgets Grid */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                    {/* Allocation Chart */}
                    <Panel className="p-6 flex flex-col bg-white shadow-sm h-full">
                        <SectionTitle
                            title="Portfolio Mix"
                            icon="pie_chart"
                            action={
                                <span className="text-[11px] text-text-muted/40 font-semibold uppercase tracking-widest italic leading-none flex items-center gap-1.5">
                                    <span className="size-1.5 bg-green-500 rounded-full animate-pulse"></span> Live
                                </span>
                            }
                        />
                        <div className="flex-1 flex items-center justify-center relative min-h-0 py-2">
                            <div className="size-40 rounded-full relative flex items-center justify-center shadow-inset overflow-hidden border border-black/5"
                                style={{
                                    background: `conic-gradient(#2c5bf6 0% ${allocation.base}%, #a855f7 ${allocation.base}% ${Math.min(100, parseFloat(allocation.base) + parseFloat(allocation.sol)) || 0}%, #e5e7eb ${Math.min(100, parseFloat(allocation.base) + parseFloat(allocation.sol)) || 0}% 100%)`
                                }}>
                                <div className="absolute inset-[10px] bg-white rounded-full flex items-center justify-center">
                                    <div className="text-center">
                                        <p className="text-3xl font-bold text-text-main font-display tracking-tight leading-none">{allocation.base}%</p>
                                        <p className="text-[10px] uppercase font-bold text-text-muted mt-2 tracking-widest leading-none">Allocation</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-3 mt-4 px-2 shrink-0">
                            <div className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-3">
                                    <div className="size-2 rounded-full bg-primary shadow-[0_0_8px_rgba(44,91,246,0.3)]"></div>
                                    <span className="font-bold text-text-main">Base Network</span>
                                </div>
                                <span className="font-bold text-text-main">{allocation.base}%</span>
                            </div>
                            <div className="flex justify-between items-center text-xs border-t border-gray-100 pt-3">
                                <div className="flex items-center gap-3">
                                    <div className="size-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.3)]"></div>
                                    <span className="font-bold text-text-main">Solana Network</span>
                                </div>
                                <span className="font-bold text-text-main">{allocation.sol}%</span>
                            </div>
                        </div>
                    </Panel>

                    {/* Alpha Feed */}
                    <AlphaFeed />

                    {/* Alerts Feed */}
                    <Panel className="p-6 flex flex-col bg-white shadow-sm h-full overflow-hidden">
                        <SectionTitle
                            title="Notifications"
                            icon="notifications_active"
                            action={
                                unreadAlertCount > 0 ? (
                                    <button
                                        onClick={markAllAlertsRead}
                                        title="Mark all read"
                                        className="size-7 flex items-center justify-center rounded-lg text-text-muted/40 hover:text-primary hover:bg-primary/5 transition-all"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">done_all</span>
                                    </button>
                                ) : null
                            }
                        />
                        <div className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
                            {alerts.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-text-muted/50 text-sm">
                                    <div className="text-center">
                                        <span className="material-symbols-outlined text-3xl mb-2 opacity-30">notifications_off</span>
                                        <p className="text-xs">No alerts yet</p>
                                    </div>
                                </div>
                            ) : alerts.map((alert, i) => (
                                <div key={alert.id || i} onClick={() => !alert.isRead && markAlertRead(alert.id)} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group hover:translate-x-0.5 ${alert.isRead ? 'bg-gray-50/50 border-black/3 opacity-50' : 'bg-gray-50 border-black/5 hover:border-primary/10'}`}>
                                    <div className={`size-8 rounded-lg ${alert.color === 'blue' ? 'bg-primary/10 border-primary/10' :
                                        alert.color === 'green' ? 'bg-green-100 border-green-200' :
                                            alert.color === 'orange' ? 'bg-orange-100 border-orange-200' :
                                                alert.color === 'red' ? 'bg-red-100 border-red-200' :
                                                    'bg-emerald-100 border-emerald-200'
                                        } flex items-center justify-center shrink-0 border`}>
                                        <span className={`material-symbols-outlined ${alert.color === 'blue' ? 'text-primary' :
                                            alert.color === 'green' ? 'text-green-600' :
                                                alert.color === 'orange' ? 'text-orange-600' :
                                                    alert.color === 'red' ? 'text-red-600' :
                                                        'text-emerald-600'
                                            } text-sm`}>{alert.icon}</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-baseline gap-2">
                                            <p className="text-sm font-bold text-text-main tracking-tight truncate">{alert.title}</p>
                                            <span className="text-[9px] text-text-muted/40 font-semibold shrink-0">{alert.time}</span>
                                        </div>
                                        <p className="text-[11px] text-text-main/50 font-medium leading-snug">{alert.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </section>
            </div>
        </div>
    );
};
