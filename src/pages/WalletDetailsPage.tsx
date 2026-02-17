import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../hooks/useData';
import { SectionTitle, Panel } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { generateAvatarUrl } from '../utils/avatar';

export const WalletDetailsPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { wallets, portfolioData, transactions } = useData();

    const wallet = useMemo(() => {
        const found = wallets.find(w => w.address === id);
        if (!found) return null;

        const isSolana = found.chainType.toLowerCase() === 'solana';
        const walletAssets = portfolioData.assets.filter(a =>
            a.walletAddress?.toLowerCase() === id?.toLowerCase()
        );

        const walletTx = transactions.filter(t => t.wallet === id);

        return {
            ...found,
            name: found.label || (isSolana ? 'Solana Wallet' : 'Base Mainnet'),
            network: isSolana ? 'Solana' : 'Base',
            status: 'Active',
            avatar: `${generateAvatarUrl(id || '')}&backgroundColor=ffffff`,
            balance: walletAssets.length > 0 ? `${walletAssets[0].balance} ${walletAssets[0].symbol}` : '0',
            value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(walletAssets.reduce((sum, a) => sum + a.value, 0)),
            assets: walletAssets.map(a => ({
                symbol: a.symbol,
                name: a.name,
                logo: a.logo,
                amount: `${a.balance} ${a.symbol}`,
                value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(a.value),
                change: `${a.change > 0 ? '+' : ''}${a.change}%`
            })),
            activity: walletTx.slice(0, 10).map(t => ({
                id: t.id || t.signature || Math.random().toString(),
                type: t.type,
                asset: t.symbol,
                amount: `${typeof t.amount === 'number' ? (t.amount >= 0 ? '+' : '') : ''}${t.amount}`,
                status: t.status,
                time: t.time
            }))
        };
    }, [id, wallets, portfolioData, transactions]);

    if (!wallet) return (
        <div className="flex h-full items-center justify-center bg-beige">
            <div className="text-center">
                <p className="text-xl font-bold font-display text-text-main">Wallet Not Found</p>
                <Button variant="bevel" className="mt-4" onClick={() => navigate('/wallet')}>Back to Wallets</Button>
            </div>
        </div>
    );

    return (
        <div className="flex-1 flex flex-col p-8 overflow-y-auto bg-beige custom-scrollbar pb-10">
            <PageHeader
                title={wallet.name}
                subtitle={`${wallet.network.toUpperCase()} • ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`}
            >
                <div className="absolute -bottom-1 left-0 flex items-center gap-3 translate-y-full mt-2">
                    <div className="size-8 rounded-lg bg-white shadow-sm border border-black/5 overflow-hidden">
                        <img src={wallet.avatar} alt={`${wallet.name} avatar`} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Ownership Verified</span>
                </div>
                <div className="flex gap-3">
                    <a
                        href={wallet.chainType.toLowerCase() === 'solana'
                            ? `https://solscan.io/account/${wallet.address}`
                            : `https://basescan.org/address/${wallet.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 h-10 bg-white border border-black/5 rounded-xl text-text-main hover:shadow-button transition-all text-[10px] font-bold uppercase tracking-widest"
                    >
                        <span className="material-symbols-outlined text-base">open_in_new</span>
                        {wallet.chainType.toLowerCase() === 'solana' ? 'Solscan' : 'Basescan'}
                    </a>
                    <Button
                        variant="bevel"
                        size="sm"
                        className="!px-4 h-10"
                        onClick={() => {
                            navigator.clipboard.writeText(wallet.address);
                        }}
                    >
                        <span className="material-symbols-outlined text-base">content_copy</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest ml-2">Copy Address</span>
                    </Button>
                    <Button variant="bevel" className="!px-5 h-10" onClick={() => navigate('/wallet')}>
                        <span className="material-symbols-outlined text-lg">arrow_back</span>
                        Back
                    </Button>
                </div>
            </PageHeader>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content: Assets */}
                <Panel className="lg:col-span-2 flex flex-col h-full overflow-hidden min-h-[500px]">
                    <div className="p-6 pb-0">
                        <SectionTitle
                            title="Wallet Assets"
                            icon="account_balance"
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scroll">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-gray-50 z-10 border-b border-gray-100 shadow-sm">
                                <tr className="text-text-muted">
                                    <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] whitespace-nowrap">Asset</th>
                                    <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-right whitespace-nowrap">Holdings</th>
                                    <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] text-right whitespace-nowrap">Value</th>
                                    <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] text-right pr-10 whitespace-nowrap">Change</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {wallet.assets.map((asset: any) => (
                                    <tr key={asset.symbol} className="hover:bg-gray-50 transition-colors group">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-4">
                                                <div className="size-9 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 border border-black/5 overflow-hidden p-1.5 shadow-sm">
                                                    {asset.logo ? (
                                                        <img src={asset.logo} alt={asset.symbol} className="w-full h-full object-contain" />
                                                    ) : (
                                                        <span className="font-bold text-[10px] text-primary/60">{asset.symbol}</span>
                                                    )}
                                                </div>
                                                <span className="font-bold text-sm tracking-tight text-text-main">{asset.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-right font-mono font-bold text-[11px] text-text-main opacity-60">{asset.amount}</td>
                                        <td className="py-4 px-6 text-right font-bold text-base tracking-tight text-text-main">{asset.value}</td>
                                        <td className="py-4 px-6 text-right pr-10">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${asset.change.startsWith('+') ? 'text-green-600 bg-green-50 border-green-100' : 'text-red-500 bg-red-50 border-red-100'}`}>
                                                {asset.change}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>

                {/* Sidebar: Activity */}
                <aside className="flex flex-col gap-6 h-full overflow-hidden">
                    <Panel className="flex-1 flex flex-col overflow-hidden min-h-[500px]">
                        <div className="p-6 pb-0">
                            <SectionTitle
                                title="Recent Activity"
                                icon="history"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scroll">
                            {wallet.activity.map((item: any) => (
                                <div key={item.id} className="flex gap-4 items-center p-4 bg-gray-50 border border-black/5 rounded-xl hover:bg-gray-50 transition-all cursor-pointer group hover:shadow-sm">
                                    <div className={`size-8 rounded-lg shrink-0 flex items-center justify-center border ${item.type === 'Receive' ? 'bg-green-50 text-green-600 border-green-100' :
                                        item.type === 'Send' ? 'bg-red-50 text-red-500 border-red-100' :
                                            'bg-blue-50 text-blue-600 border-blue-100'
                                        } transition-transform group-hover:scale-105`}>
                                        <span className="material-symbols-outlined text-base">
                                            {item.type === 'Receive' ? 'south_west' :
                                                item.type === 'Send' ? 'north_east' :
                                                    'swap_horiz'}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <p className="text-sm font-bold text-text-main tracking-tight">{item.type} {item.asset}</p>
                                            <span className="text-[11px] font-bold text-text-main uppercase tracking-[0.1em]">{item.time}</span>
                                        </div>
                                        <div className="flex justify-between items-center mt-0.5">
                                            <p className="font-mono text-[11px] font-bold text-text-main tracking-tight">{item.amount}</p>
                                            <p className="text-[11px] font-bold text-green-600 uppercase tracking-widest">{item.status}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </aside>
            </div>
        </div>
    );
};
