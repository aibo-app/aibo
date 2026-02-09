import React from 'react';

const COINS = [
    { symbol: 'BTC', price: '$68,420.50', change: '+2.1%', isUp: true },
    { symbol: 'ETH', price: '$3,510.12', change: '+1.4%', isUp: true },
    { symbol: 'SOL', price: '$148.89', change: '+4.2%', isUp: true },
    { symbol: 'BNB', price: '$598.45', change: '-0.3%', isUp: false },
    { symbol: 'ADA', price: '$0.45', change: '-1.1%', isUp: false },
    { symbol: 'DOT', price: '$7.12', change: '+2.5%', isUp: true },
];

export const Ticker: React.FC = () => {
    const [marketData, setMarketData] = React.useState<any[]>(COINS);

    React.useEffect(() => {
        const fetchTrends = async () => {
            try {
                const res = await fetch('http://localhost:3001/api/market/trends');
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) {
                        setMarketData(data);
                    }
                }
            } catch (e) {
                console.error('Failed to fetch market trends:', e);
            }
        };

        fetchTrends();
        // Refresh every minute
        const interval = setInterval(fetchTrends, 60000);
        return () => clearInterval(interval);
    }, []);

    // Duplicate data to ensure smooth infinite scroll
    const items = [...marketData, ...marketData, ...marketData];

    return (
        <div className="w-full bg-white/80 backdrop-blur border-b border-black/5 py-2 ticker-wrap z-50 shadow-sm">
            <div className="ticker-content flex gap-12 text-xs font-body font-medium items-center text-text-main">
                {items.map((coin, i) => (
                    <span key={i} className="flex gap-2">
                        <span>{coin.symbol}: {coin.price}</span>
                        <span className={`font-bold ${coin.isUp ? 'text-green-600' : 'text-red-500'}`}>
                            {coin.isUp ? '▲' : '▼'} {coin.change.replace(/[+-]/, '')}
                        </span>
                    </span>
                ))}
            </div>
        </div>
    );
};
