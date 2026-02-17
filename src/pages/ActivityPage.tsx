import React, { useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel, SectionTitle } from '../components/ui/Panel';
import { useData } from '../hooks/useData';
import { generateAvatarUrl } from '../utils/avatar';

// Static Tailwind class map (dynamic classes like `text-${color}-600` are stripped at build time)
const textColorMap: Record<string, string> = {
    green: 'text-green-600', red: 'text-red-600', blue: 'text-blue-600',
    orange: 'text-orange-600', purple: 'text-purple-600', gray: 'text-gray-600',
};

export const ActivityPage: React.FC = () => {
    const { transactions, wallets, loading } = useData();
    const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');

    const filteredTransactions = React.useMemo(() => {
        return transactions.filter(tx => {
            if (filter === 'all') return true;
            const isReceive = typeof tx.amount === 'number' ? tx.amount >= 0 : tx.type.toLowerCase().includes('receive');
            if (filter === 'in') return isReceive;
            if (filter === 'out') return !isReceive;
            return true;
        }).map(tx => {
            const isUp = typeof tx.amount === 'number' ? tx.amount >= 0 : tx.type.toLowerCase().includes('receive');

            // Logic for Bought/Sold enhancement
            let displayType = tx.type;
            let typeIcon = 'toll';
            let typeColor = 'gray';

            if (tx.type.toLowerCase() === 'swap') {
                if (tx.amount >= 0) {
                    displayType = 'Bought';
                    typeIcon = 'shopping_cart';
                    typeColor = 'green';
                } else {
                    displayType = 'Sold';
                    typeIcon = 'sell';
                    typeColor = 'red';
                }
            } else if (tx.type.toLowerCase().includes('receive')) {
                displayType = 'Received';
                typeIcon = 'arrow_downward';
                typeColor = 'green';
            } else if (tx.type.toLowerCase().includes('send')) {
                displayType = 'Sent';
                typeIcon = 'arrow_upward';
                typeColor = 'red';
            }

            // Wallet name resolution
            const walletAddr = tx.wallet || tx.walletAddress || '';
            const matchedWallet = wallets.find(w => w.address.toLowerCase() === walletAddr.toLowerCase());
            const truncatedAddr = walletAddr ? `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}` : '';
            const accountLabel = matchedWallet?.label || tx.label || truncatedAddr || 'Unknown';
            const accountAddress = truncatedAddr;

            return {
                ...tx,
                type: displayType,
                typeIcon,
                typeColor,
                isUp,
                displayAmount: `${typeof tx.amount === 'number' ? (tx.amount >= 0 ? '+ ' : '- ') : ''}${parseFloat(Math.abs(Number(tx.amount)).toFixed(3))} ${tx.symbol}`,
                displayValue: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(tx.value || 0),
                icon: tx.symbol === 'BTC' ? 'currency_bitcoin' : tx.symbol === 'ETH' ? 'diamond' : tx.symbol === 'SOL' ? 'deployed_code' : tx.symbol === 'USDC' ? 'account_balance' : 'token',
                color: tx.symbol === 'BTC' ? 'orange' : tx.symbol === 'ETH' ? 'blue' : tx.symbol === 'SOL' ? 'purple' : tx.symbol === 'USDC' ? 'blue' : 'gray',
                network: tx.chain === 'SOLANA' ? 'Solana' : tx.chain === 'EVM' ? 'Base' : 'Ethereum',
                networkLogo: tx.chain === 'SOLANA'
                    ? 'https://assets.coingecko.com/coins/images/4128/small/solana.png'
                    : 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
                assetLogo: tx.logo || (
                    tx.symbol === 'ETH' ? 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' :
                        tx.symbol === 'SOL' ? 'https://assets.coingecko.com/coins/images/4128/small/solana.png' :
                            tx.symbol === 'USDC' ? 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png' :
                                tx.symbol === 'JUP' ? 'https://assets.coingecko.com/coins/images/34188/small/jup.png' : null),
                accountLabel,
                accountAddress,
                accountAvatar: `${generateAvatarUrl(tx.wallet || accountAddress)}&backgroundColor=ffffff`,
                accountColor: matchedWallet
                    ? (matchedWallet.chainType.toLowerCase() === 'solana' ? 'purple' : 'blue')
                    : 'gray'
            };
        });
    }, [transactions, filter, wallets]);

    if (loading && filteredTransactions.length === 0) {
        return (
            <div className="flex h-full items-center justify-center bg-beige">
                <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col p-8 bg-beige h-full overflow-hidden">
            <PageHeader
                title="Activity history"
                subtitle="Track and verify your fund history."
            >
                <div className="flex items-center bg-white p-1 rounded-2xl border border-black/5">
                    {(['all', 'in', 'out'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${filter === f
                                ? 'bg-white text-primary border border-black/5'
                                : 'text-text-muted hover:text-text-main hover:bg-black/5'
                                }`}
                        >
                            {f === 'all' ? 'All' : f === 'in' ? 'Incoming' : 'Outgoing'}
                        </button>
                    ))}
                </div>
            </PageHeader>

            <Panel className="flex-1 flex flex-col mb-6 bg-white overflow-hidden shadow-sm">
                <div className="p-6 pb-0">
                    <SectionTitle
                        title="Transaction Ledger"
                        icon="history"
                    />
                </div>
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-gray-50 z-10 border-b border-gray-100 shadow-sm">
                            <tr className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">
                                <th className="py-3 px-6 w-1/4 whitespace-nowrap">Activity</th>
                                <th className="py-3 px-4 whitespace-nowrap">Asset</th>

                                <th className="py-3 px-4 whitespace-nowrap">Account</th>
                                <th className="py-3 px-4 whitespace-nowrap">Timestamp</th>
                                <th className="py-3 px-6 text-right whitespace-nowrap">Net Value</th>
                                <th className="py-3 px-6 w-16 text-center whitespace-nowrap">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredTransactions.map((tx, index) => (
                                <tr key={tx.id || index} className="group hover:bg-gray-50 transition-colors">
                                    <td className="py-3 px-6">
                                        <div className="flex items-center gap-3">
                                            <div className={`size-8 rounded-lg flex items-center justify-center bg-gray-50 border border-black/5 shrink-0`}>
                                                <span className={`material-symbols-outlined ${textColorMap[tx.typeColor] || 'text-gray-600'} text-sm`}>{tx.typeIcon}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <p className="font-display font-semibold text-text-main text-base tracking-tight">{tx.type}</p>
                                                <p className="text-[11px] text-text-muted font-semibold uppercase tracking-widest opacity-40">{tx.label || 'Authorization'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <div className="size-7 rounded-lg flex items-center justify-center bg-gray-50 border border-black/5 shrink-0 overflow-hidden p-1.5">
                                                {tx.assetLogo ? (
                                                    <img src={tx.assetLogo} alt={tx.symbol} className="w-full h-full object-contain" />
                                                ) : (
                                                    <span className={`material-symbols-outlined ${textColorMap[tx.color] || 'text-gray-600'} text-sm`}>{tx.icon}</span>
                                                )}
                                            </div>
                                            <span className="font-semibold text-text-main text-sm tracking-tight">{tx.symbol}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <div className="size-6 rounded-lg flex items-center justify-center bg-gray-50 border border-black/5 shrink-0 overflow-hidden">
                                                <img src={tx.accountAvatar} alt={`${tx.accountLabel || 'Account'} avatar`} className="w-full h-full object-cover" />
                                            </div>
                                            <span className="font-bold text-text-main text-sm tracking-tight">{tx.accountLabel}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-[11px] font-bold text-text-main uppercase tracking-widest">
                                        {tx.time}
                                    </td>
                                    <td className="py-3 px-6 text-right">
                                        <p className={`font-display font-bold text-base tracking-tighter ${tx.isUp ? 'text-green-600' : 'text-text-main'}`}>{tx.displayAmount}</p>
                                        <p className="text-[11px] font-semibold text-text-muted opacity-40 uppercase tracking-[0.15em]">{tx.displayValue}</p>
                                    </td>
                                    <td className="py-3 px-6 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className={`size-2.5 rounded-full ring-3 ${tx.isUp ? 'bg-green-500 ring-green-100' : 'bg-primary ring-blue-100'}`}></div>
                                            {(tx.signature || tx.hash) && (
                                                <a
                                                    href={tx.chain === 'SOLANA'
                                                        ? `https://solscan.io/tx/${tx.signature || tx.hash}`
                                                        : `https://basescan.org/tx/${tx.signature || tx.hash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                                                    title={tx.chain === 'SOLANA' ? 'View on Solscan' : 'View on Basescan'}
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <span className="material-symbols-outlined text-sm text-text-muted">open_in_new</span>
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 border-t border-gray-100 bg-white flex justify-between items-center z-10 shrink-0 shadow-sm">
                    <span className="text-[11px] text-text-muted font-semibold uppercase tracking-widest flex items-center gap-2">
                        <span className="size-2 bg-primary rounded-full shadow-[0_0_8px_rgba(44,91,246,0.3)]"></span>
                        Records Indexed: {filteredTransactions.length}
                    </span>
                </div>
            </Panel>
        </div>
    );
};
