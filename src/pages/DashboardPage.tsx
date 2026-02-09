import React, { useState } from 'react';

const MOCK_TRANSACTIONS = [
    {
        id: 1, type: 'Received', label: 'External Deposit',
        amount: '+ 0.45 BTC', value: '$30,789.22',
        asset: 'Bitcoin', symbol: 'BTC', icon: 'currency_bitcoin', color: 'orange',
        date: 'Oct 24, 2024 at 14:32', fee: '$12.50', status: 'confirmed'
    },
    {
        id: 2, type: 'Payment', label: 'Online Purchase',
        amount: '- 450.00 USDC', value: '$450.00',
        asset: 'USD Coin', symbol: 'USDC', icon: 'token', color: 'blue',
        date: 'Oct 24, 2024 at 11:15', fee: '$1.05', status: 'confirmed'
    },
    {
        id: 3, type: 'Transfer', label: 'Internal Transfer',
        amount: '- 2.5 ETH', value: '$8,775.30',
        asset: 'Ethereum', symbol: 'ETH', icon: 'diamond', color: 'gray',
        date: 'Oct 23, 2024 at 18:45', fee: '$4.20', status: 'confirmed'
    },
    {
        id: 4, type: 'Investment', label: 'Asset Acquisition',
        amount: '+ 150 SOL', value: '$22,333.50',
        asset: 'Solana', symbol: 'SOL', icon: 'deployed_code', color: 'purple',
        date: 'Oct 23, 2024 at 09:12', fee: '$0.85', status: 'confirmed'
    }
];

export const DashboardPage: React.FC = () => {
    const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');

    return (
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
            {/* Header */}
            <header className="flex justify-between items-end mb-8 shrink-0">
                <div>
                    <h1 className="text-xs uppercase tracking-widest font-bold text-text-muted mb-1 font-body">Fund History</h1>
                    <h2 className="text-3xl font-bold tracking-tight text-text-main font-display">
                        Aibō <span className="text-primary">Ledger</span>
                    </h2>
                </div>
                <div className="flex gap-4 items-center">
                    <div className="flex items-center bg-white rounded-lg shadow-sm border border-black/5 p-1">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filter === 'all' ? 'bg-gray-100 text-text-main shadow-sm' : 'text-text-muted hover:bg-gray-50'}`}
                        >
                            All Activity
                        </button>
                        <button
                            onClick={() => setFilter('in')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filter === 'in' ? 'bg-gray-100 text-text-main shadow-sm' : 'text-text-muted hover:bg-gray-50'}`}
                        >
                            Incoming
                        </button>
                        <button
                            onClick={() => setFilter('out')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filter === 'out' ? 'bg-gray-100 text-text-main shadow-sm' : 'text-text-muted hover:bg-gray-50'}`}
                        >
                            Outgoing
                        </button>
                    </div>
                    <button className="size-9 bg-white rounded-lg flex items-center justify-center shadow-sm border border-black/5 text-text-muted hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-lg">filter_list</span>
                    </button>
                    <button className="size-9 bg-white rounded-lg flex items-center justify-center shadow-sm border border-black/5 text-text-muted hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-lg">download</span>
                    </button>
                </div>
            </header>

            {/* Ledger Content */}
            <div className="soft-panel flex-1 flex flex-col overflow-hidden relative mb-6">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-primary/10"></div>

                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-100 bg-gray-50/50 text-[10px] uppercase font-bold text-text-muted tracking-wider shrink-0">
                    <div className="col-span-1 text-center">Status</div>
                    <div className="col-span-4">Transaction Details</div>
                    <div className="col-span-3">Asset</div>
                    <div className="col-span-3 text-right">Value</div>
                    <div className="col-span-1 text-center">Expand</div>
                </div>

                {/* Rows */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {MOCK_TRANSACTIONS.map((tx) => (
                        <details key={tx.id} className="group border-b border-gray-50 last:border-0 cursor-pointer">
                            <summary className="ledger-row grid grid-cols-12 gap-4 px-6 py-5 items-center transition-colors">
                                <div className="col-span-1 flex justify-center">
                                    <div className={`size-3 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)] ring-4 ${tx.amount.startsWith('+') ? 'bg-green-500 ring-green-50' : 'bg-primary ring-blue-50'}`}></div>
                                </div>
                                <div className="col-span-4">
                                    <p className="font-display font-semibold text-text-main text-base">{tx.type} {tx.amount.startsWith('+') ? 'from' : 'to'} Unknown</p>
                                    <p className="text-xs text-text-muted mt-0.5">{tx.label}</p>
                                </div>
                                <div className="col-span-3 flex items-center gap-2">
                                    <div className={`size-6 rounded-full flex items-center justify-center bg-${tx.color}-100`}>
                                        {/* Material symbols handled by global font link in index.html, assume class exists */}
                                        <span className={`material-symbols-outlined text-${tx.color}-600 text-sm`}>{tx.icon}</span>
                                    </div>
                                    <span className="font-medium text-text-main">{tx.asset}</span>
                                </div>
                                <div className="col-span-3 text-right">
                                    <p className={`font-display font-bold text-lg ${tx.amount.startsWith('+') ? 'text-green-600' : 'text-text-main'}`}>{tx.amount}</p>
                                    <p className="text-xs text-text-muted">{tx.value}</p>
                                </div>
                                <div className="col-span-1 flex justify-center">
                                    <span className="material-symbols-outlined text-text-muted group-open:rotate-180 transition-transform">expand_more</span>
                                </div>
                            </summary>

                            {/* Expanded Details */}
                            <div className="ledger-details px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center text-sm">
                                <div className="flex gap-8">
                                    <div>
                                        <span className="block text-[10px] uppercase font-bold text-text-muted mb-1">Date & Time</span>
                                        <span className="font-medium text-text-main">{tx.date}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] uppercase font-bold text-text-muted mb-1">Fee</span>
                                        <span className="font-medium text-text-main">{tx.fee}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] uppercase font-bold text-text-muted mb-1">Verification</span>
                                        <a className="text-primary hover:underline font-medium flex items-center gap-1" href="#">
                                            Proof of Transaction
                                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                                        </a>
                                    </div>
                                </div>
                                <button className="text-xs font-bold text-text-muted bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm hover:text-primary transition-colors">
                                    Request Technical Data
                                </button>
                            </div>
                        </details>
                    ))}
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-gray-100 bg-white flex justify-between items-center z-10 shrink-0">
                    <span className="text-xs text-text-muted font-medium">Showing latest {MOCK_TRANSACTIONS.length} of 1,204 transactions</span>
                    <div className="flex gap-2">
                        <button className="px-3 py-1.5 rounded border border-gray-200 text-text-muted text-xs font-bold hover:bg-gray-50 disabled:opacity-50">Previous</button>
                        <button className="px-3 py-1.5 rounded border border-gray-200 text-text-main text-xs font-bold hover:bg-gray-50 hover:border-primary/30">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
