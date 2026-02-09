import React from 'react';

const MOCK_ASSETS = [
    { symbol: 'SOL', name: 'Solana', price: '$148.89', balance: '25.5 SOL', value: '$3,799.50', change: '+4.2%', color: 'purple', icon: 'token' },
    { symbol: 'BTC', name: 'Bitcoin', price: '$68,420.50', balance: '12.45 BTC', value: '$851,835.22', change: '+2.1%', color: 'orange', icon: 'currency_bitcoin' },
    { symbol: 'ETH', name: 'Ethereum', price: '$3,510.12', balance: '45.2 ETH', value: '$158,657.42', change: '+1.4%', color: 'indigo', icon: 'diamond' }, // Using diamond as ETH icon proxy
    { symbol: 'USDC', name: 'USD Coin', price: '$1.00', balance: '154,200.00 USDC', value: '$154,200.00', change: '0.0%', color: 'blue', icon: 'attach_money' },
    { symbol: 'BNB', name: 'BNB', price: '$598.45', balance: '120.5 BNB', value: '$72,113.22', change: '-0.3%', color: 'yellow', icon: 'Hexagon' }, // Proxy icon
    { symbol: 'LINK', name: 'Chainlink', price: '$17.50', balance: '400.0 LINK', value: '$7,000.00', change: '+1.2%', color: 'blue', icon: 'link' },
    { symbol: 'TAO', name: 'Bittensor', price: '$612.45', balance: '10.0 TAO', value: '$6,124.50', change: '+8.2%', color: 'green', icon: 'smart_toy' },
];

export const WalletPage: React.FC = () => {
    return (
        <div className="flex h-full flex-col p-6 overflow-hidden bg-beige">
            <header className="flex justify-between items-end mb-6 shrink-0">
                <div>
                    <h1 className="text-xs uppercase tracking-widest font-bold text-text-muted mb-1 font-body">Vault Management</h1>
                    <h2 className="text-3xl font-bold tracking-tight text-text-main font-display">Safe Vaults Inventory</h2>
                </div>
                <div className="flex gap-3">
                    <button className="bg-white text-text-main border border-gray-200 font-bold px-4 py-2 rounded-lg shadow-bevel hover:bg-gray-50 transition-all font-display tracking-wide text-xs flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">download</span>
                        Export CSV
                    </button>
                    <button className="bg-primary text-white font-bold px-4 py-2 rounded-lg shadow-button hover:bg-primary/90 transition-all font-display tracking-wide text-xs flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">add</span>
                        Add Asset
                    </button>
                </div>
            </header>

            <div className="flex flex-1 gap-6 overflow-hidden">
                {/* Main Table Panel */}
                <div className="flex-1 soft-panel flex flex-col overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary to-blue-300"></div>

                    <div className="p-6 pb-2 flex justify-between items-center shrink-0">
                        <div className="flex gap-2">
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-2.5 top-2 text-gray-400 text-sm">search</span>
                                <input
                                    className="pl-8 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none shadow-input w-64 placeholder:text-gray-400"
                                    placeholder="Search assets..."
                                    type="text"
                                />
                            </div>
                            <button className="p-1.5 bg-white border border-gray-200 rounded-lg text-text-muted hover:text-primary shadow-sm">
                                <span className="material-symbols-outlined text-sm">filter_list</span>
                            </button>
                        </div>
                        <div className="text-xs text-text-muted font-medium">
                            Showing {MOCK_ASSETS.length} of 12 Assets
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 pt-2 custom-scrollbar">
                        <table className="w-full text-left asset-table">
                            <thead>
                                <tr>
                                    <th className="pl-2">Asset Name</th>
                                    <th className="text-right">Price</th>
                                    <th className="text-right">Balance</th>
                                    <th className="text-right">Value (USD)</th>
                                    <th className="text-right pr-2">24h Change</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm font-medium text-text-main">
                                {MOCK_ASSETS.map((asset) => (
                                    <tr key={asset.symbol} className="group hover:bg-gray-50 transition-colors cursor-pointer rounded-lg">
                                        <td className="pl-2">
                                            <div className="flex items-center gap-3">
                                                <div className="size-9 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm p-1">
                                                    {['SOL', 'BTC', 'ETH', 'USDC', 'BNB'].includes(asset.symbol) ? (
                                                        // Fallback icons for now, ideally images
                                                        <span className={`material-symbols-outlined text-${asset.color}-600 text-sm`}>{asset.icon}</span>
                                                    ) : (
                                                        <span className="text-xs font-bold">{asset.symbol}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold font-display text-base">{asset.name}</div>
                                                    <div className="text-[10px] text-text-muted font-mono uppercase">{asset.symbol}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-right font-mono text-text-muted">{asset.price}</td>
                                        <td className="text-right font-mono">{asset.balance}</td>
                                        <td className="text-right font-bold font-display text-base">{asset.value}</td>
                                        <td className="text-right pr-2">
                                            <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold border ${asset.change.startsWith('+') ? 'bg-green-50 text-green-600 border-green-100' : asset.change.startsWith('-') ? 'bg-red-50 text-red-500 border-red-100' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                                {asset.change}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Sidebar Chart Panel */}
                <aside className="w-80 flex flex-col gap-6 shrink-0">
                    <div className="soft-panel p-6 flex flex-col h-full relative overflow-hidden">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-2">
                            <h4 className="text-sm font-bold text-text-main flex items-center gap-2 font-display">
                                <span className="material-symbols-outlined text-primary text-lg">show_chart</span>
                                Vault Growth
                            </h4>
                            <div className="flex bg-gray-100 rounded-lg p-0.5">
                                <button className="px-2 py-0.5 bg-white text-[10px] font-bold text-text-main rounded shadow-sm">7D</button>
                                <button className="px-2 py-0.5 text-[10px] font-medium text-text-muted hover:text-text-main">1M</button>
                                <button className="px-2 py-0.5 text-[10px] font-medium text-text-muted hover:text-text-main">1Y</button>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1 mb-8">
                            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Primary Savings Performance</span>
                            <div className="flex items-baseline gap-3">
                                <span className="text-4xl font-display font-extrabold text-text-main">+4.2%</span>
                                <span className="text-sm font-bold text-green-600 bg-green-50 px-1.5 rounded border border-green-100">+$51,200</span>
                            </div>
                        </div>
                        <div className="relative h-48 w-full mt-4">
                            {/* SVG Chart Placeholder - keeping it simple for now matching the HTML structure basically */}
                            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 50">
                                <defs>
                                    <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                                        <stop offset="0%" stopColor="#2c5bf6" stopOpacity="0.2"></stop>
                                        <stop offset="100%" stopColor="#2c5bf6" stopOpacity="0"></stop>
                                    </linearGradient>
                                </defs>
                                <path d="M0,45 C10,40 20,42 30,35 C40,28 50,32 60,20 C70,15 80,18 90,5 L100,2 L100,50 L0,50 Z" fill="url(#chartGradient)"></path>
                                <path d="M0,45 C10,40 20,42 30,35 C40,28 50,32 60,20 C70,15 80,18 90,5 L100,2" fill="none" stroke="#2c5bf6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                <circle cx="100" cy="2" fill="white" r="2" stroke="#2c5bf6" strokeWidth="1.5"></circle>
                            </svg>
                            <div className="flex justify-between text-[9px] text-text-muted mt-2 font-mono uppercase">
                                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                            </div>
                        </div>
                        <div className="mt-auto pt-6 border-t border-gray-100 space-y-3">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-text-muted">High (24h)</span>
                                <span className="font-mono font-bold text-text-main">$1,252,100</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-text-muted">Low (24h)</span>
                                <span className="font-mono font-bold text-text-main">$1,198,400</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-text-muted">Volume</span>
                                <span className="font-mono font-bold text-text-main">$42,500</span>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
};
