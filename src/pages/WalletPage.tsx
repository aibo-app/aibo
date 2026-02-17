import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../hooks/useData';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel, SectionTitle } from '../components/ui/Panel';
import { generateAvatarUrl } from '../utils/avatar';
import { API_BASE } from '../lib/api';

export const WalletPage: React.FC = () => {
    const navigate = useNavigate();
    const { wallets: backendWallets, portfolioData, loading, refreshData } = useData();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newAddress, setNewAddress] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [newNetwork, setNewNetwork] = useState<'solana' | 'evm'>('evm');
    const [addError, setAddError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletedAddresses, setDeletedAddresses] = useState<Set<string>>(new Set());

    // Enrich backend wallets with display data and calculated values
    const displayWallets = useMemo(() => {
        return backendWallets
            .filter(w => !deletedAddresses.has(w.address.toLowerCase()))
            .map((w) => {
                const isSolana = w.chainType.toLowerCase() === 'solana';

                // Match assets to wallets using the walletAddress tag from the backend
                const walletAssets = portfolioData.assets.filter(a =>
                    a.walletAddress?.toLowerCase() === w.address.toLowerCase()
                );

                const totalValue = walletAssets.reduce((sum, a) => sum + a.value, 0);
                const avatarUrl = `${generateAvatarUrl(w.address)}&backgroundColor=ffffff`;

                const weightedChange = totalValue > 0
                    ? walletAssets.reduce((sum, a) => sum + ((a.value / totalValue) * a.change), 0)
                    : 0;

                return {
                    id: w.address,
                    name: w.label || (isSolana ? 'Solana Wallet' : 'Base Mainnet'),
                    network: isSolana ? 'Solana' : 'Base',
                    symbol: isSolana ? 'S' : 'B',
                    chainLogo: isSolana
                        ? 'https://assets.coingecko.com/coins/images/4128/small/solana.png'
                        : 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
                    address: w.address,
                    value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalValue),
                    change: walletAssets.length > 0 ? `${weightedChange >= 0 ? '+' : ''}${weightedChange.toFixed(2)}%` : null,
                    isUp: walletAssets.length > 0 ? weightedChange >= 0 : null,
                    color: isSolana ? 'purple' : 'blue',
                    avatar: avatarUrl,
                    rawTotalValue: totalValue
                };
            });
    }, [backendWallets, portfolioData, deletedAddresses]);

    const handleRowClick = (id: string, e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.action-btn')) return;
        navigate(`/wallet/${id}`);
    };

    const handleAddWallet = async () => {
        if (!newAddress.trim()) {
            setAddError('Wallet address is required');
            return;
        }
        setAddError('');
        setIsSubmitting(true);
        try {
            const res = await fetch(`${API_BASE}/api/wallets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: newAddress.trim(),
                    label: newLabel.trim() || undefined,
                    chainType: newNetwork,
                }),
            });
            if (res.ok) {
                setNewAddress('');
                setNewLabel('');
                setNewNetwork('evm');
                setIsAddModalOpen(false);
                refreshData();
            } else {
                const data = await res.json();
                setAddError(data.error || 'Failed to add wallet');
            }
        } catch {
            setAddError('Network error — is the server running?');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteWallet = async (address: string, e: React.MouseEvent) => {
        e.stopPropagation();

        // Optimistic UI: Hide immediately
        setDeletedAddresses(prev => new Set(prev).add(address.toLowerCase()));

        try {
            const res = await fetch(`${API_BASE}/api/wallets/${encodeURIComponent(address)}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete wallet');

            // Re-fetch to sync with backend
            refreshData();
        } catch (err) {
            console.error('Delete wallet failed:', err);
            // Revert optimistic UI on failure
            setDeletedAddresses(prev => {
                const next = new Set(prev);
                next.delete(address.toLowerCase());
                return next;
            });
        }
    };

    if (loading && displayWallets.length === 0) {
        return (
            <div className="flex h-full items-center justify-center bg-beige">
                <div className="flex flex-col items-center gap-2">
                    <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Updating Portfolio...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col p-8 overflow-y-auto bg-beige custom-scrollbar pb-10">
            <PageHeader
                title="Connected Wallets"
                subtitle="Manage and track your crypto portfolio sources"
            >
                <Button
                    variant="primary"
                    size="sm"
                    className="!px-4 h-10 flex items-center gap-2"
                    onClick={() => setIsAddModalOpen(true)}
                >
                    <span className="material-symbols-outlined text-lg">add_circle</span>
                    <span className="font-semibold text-[11px] uppercase tracking-wider">Track Wallet</span>
                </Button>
            </PageHeader>

            <Panel className="flex-1 flex flex-col min-h-[400px] shadow-sm bg-white overflow-hidden">
                <div className="p-5 pb-0">
                    <SectionTitle
                        title="Wallet Portfolio"
                        icon="account_balance_wallet"
                    />
                </div>
                <div className="flex-1 overflow-x-auto custom-scroll">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="py-4 px-6 text-[11px] font-semibold text-text-muted uppercase tracking-[0.2em] w-1/4 whitespace-nowrap">Identity</th>

                                <th className="py-4 px-6 text-[11px] font-semibold text-text-muted uppercase tracking-[0.2em] whitespace-nowrap">Address</th>
                                <th className="py-4 px-6 text-[11px] font-semibold text-text-muted uppercase tracking-[0.2em] text-right whitespace-nowrap">24h Gain</th>
                                <th className="py-4 px-6 text-[11px] font-semibold text-text-muted uppercase tracking-[0.2em] text-right pr-10 whitespace-nowrap">Balance</th>
                                <th className="py-4 px-6 text-[11px] font-semibold text-text-muted uppercase tracking-[0.2em] w-12 text-right pr-6"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                            {displayWallets.map((wallet) => (
                                <tr
                                    key={wallet.id}
                                    onClick={(e) => handleRowClick(wallet.id, e)}
                                    className="hover:bg-gray-50 transition-all group cursor-pointer border-l-4 border-l-transparent hover:border-l-primary"
                                >
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-4">
                                            <div className="size-9 rounded-xl bg-gray-50 flex items-center justify-center border border-black/5 shrink-0 overflow-hidden">
                                                <img src={wallet.avatar} alt={`${wallet.name} avatar`} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-text-main font-display text-base tracking-tight">
                                                    {wallet.name}
                                                </span>
                                                <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest opacity-40 mt-0.5">Verified Node</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-3 group/addr">
                                            <span className="font-bold text-text-main text-sm tracking-tight">{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigator.clipboard.writeText(wallet.address);
                                                }}
                                                className="opacity-0 group-hover/addr:opacity-100 p-1 hover:bg-gray-100 rounded-lg transition-all active:scale-95"
                                                title="Copy Address"
                                            >
                                                <span className="material-symbols-outlined text-xs text-primary">content_copy</span>
                                            </button>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        {wallet.change !== null ? (
                                            <span className={`text-[10px] font-bold ${wallet.isUp ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'} px-2 py-0.5 rounded-lg inline-flex items-center gap-1 border ${wallet.isUp ? 'border-green-100' : 'border-red-100'} shadow-sm`}>
                                                <span className="material-symbols-outlined text-[10px]">
                                                    {wallet.isUp ? 'trending_up' : 'trending_down'}
                                                </span>
                                                {wallet.change}
                                            </span>
                                        ) : (
                                            <div className="h-4 w-14 bg-gray-100 rounded-lg animate-pulse inline-block" />
                                        )}
                                    </td>
                                    <td className="py-4 px-6 text-right pr-10">
                                        <span className="font-bold text-text-main font-display text-lg tracking-tighter">{wallet.value}</span>
                                    </td>
                                    <td className="py-4 px-6 text-right pr-8">
                                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100">
                                            <button
                                                className="action-btn text-text-muted hover:text-red-500 transition-all p-1.5 rounded-xl hover:bg-red-50 border border-transparent hover:border-red-100"
                                                onClick={(e) => handleDeleteWallet(wallet.address, e)}
                                                title="Remove wallet"
                                            >
                                                <span className="material-symbols-outlined text-base">delete</span>
                                            </button>
                                            <button
                                                className="action-btn text-text-main hover:text-primary transition-all p-1.5 rounded-xl hover:bg-white hover:shadow-button border border-transparent hover:border-black/5"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/wallet/${wallet.id}`);
                                                }}
                                            >
                                                <span className="material-symbols-outlined text-base">arrow_forward</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Panel>

            {/* Add Wallet Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsAddModalOpen(false)}>
                    <div className="w-full max-w-md bg-white p-8 rounded-xl border border-black/5 shadow-sm animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-2 font-display">Track New Wallet</h3>
                        <p className="text-sm text-text-muted mb-6">Enter a wallet address to start tracking.</p>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[11px] font-semibold uppercase tracking-widest text-text-muted mb-2 block">Wallet Address</label>
                                <Input
                                    placeholder="0x... or base58 Solana address"
                                    className="w-full text-sm !py-3"
                                    value={newAddress}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAddress(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-semibold uppercase tracking-widest text-text-muted mb-2 block">Label (optional)</label>
                                <Input
                                    placeholder="e.g. Cold Storage"
                                    className="w-full text-sm !py-3"
                                    value={newLabel}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewLabel(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-semibold uppercase tracking-widest text-text-muted mb-2 block">Network</label>
                                <select
                                    className="w-full bg-gray-50 border border-black/5 rounded-xl text-sm px-4 py-3 outline-none focus:ring-1 focus:ring-primary h-12 appearance-none font-medium"
                                    value={newNetwork}
                                    onChange={(e) => setNewNetwork(e.target.value as 'solana' | 'evm')}
                                >
                                    <option value="evm">Base</option>
                                    <option value="solana">Solana</option>
                                </select>
                            </div>
                            {addError && (
                                <p className="text-xs text-red-500 font-medium">{addError}</p>
                            )}
                        </div>
                        <div className="flex gap-3 mt-8">
                            <Button variant="bevel" className="flex-1" onClick={() => { setIsAddModalOpen(false); setAddError(''); }}>Cancel</Button>
                            <Button variant="primary" className="flex-1" onClick={handleAddWallet} disabled={isSubmitting}>
                                {isSubmitting ? 'Adding...' : 'Track Wallet'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
