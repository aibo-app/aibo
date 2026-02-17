import React, { useMemo } from 'react';
import { WindowControls, MacWindowControls } from './WindowControls';
import { useData } from '../../hooks/useData';

// Symbols shown while loading (skeleton placeholders)
const SKELETON_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA', 'DOT'];

interface MarketCoin {
    symbol: string;
    name?: string;
    price: string;
    change: string;
    isUp: boolean;
    logo?: string;
}

export const Ticker: React.FC = () => {
    const { marketTrends } = useData();

    // Map MarketTrend[] from context to MarketCoin[] for display
    // Memoize to prevent animation restart on re-renders
    const realItems = useMemo(() => {
        if (!marketTrends || marketTrends.length === 0) return null;
        const mapped: MarketCoin[] = marketTrends.map(t => ({
            symbol: t.symbol,
            name: t.name,
            price: typeof t.price === 'number' ? `$${t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : (String(t.price).startsWith('$') ? String(t.price) : `$${t.price}`),
            change: typeof t.change === 'number' ? `${t.change > 0 ? '+' : ''}${t.change.toFixed(2)}%` : `${t.change}`,
            isUp: t.isUp ?? (typeof t.change === 'number' ? t.change > 0 : !String(t.change).startsWith('-')),
            logo: t.logo || t.image
        }));
        // Triplicate for seamless infinite scroll
        return [...mapped, ...mapped, ...mapped];
    }, [marketTrends]);
    const skeletonItems = [...SKELETON_SYMBOLS, ...SKELETON_SYMBOLS, ...SKELETON_SYMBOLS];

    const platform = window.electronAPI?.platform || 'darwin';
    const isMac = platform === 'darwin';

    return (
        <div className="w-full relative">
            {/* Mac traffic light buttons - floating on top */}
            {isMac && (
                <div className="absolute top-0 left-0 z-50 flex items-center h-10 w-20 justify-center no-drag">
                    <MacWindowControls />
                </div>
            )}

            {/* Ticker bar */}
            <div className="w-full bg-white h-10 z-40 flex items-center overflow-hidden select-none app-drag" style={{
                borderTop: '1px solid #ffffff',
                borderBottom: '1px solid #716f64'
            } as React.CSSProperties}>
                {/* Mac traffic light buttons space */}
                {isMac && (
                    <div className="shrink-0 w-20 h-full no-drag">
                        {/* Empty space reserved for floating traffic lights */}
                    </div>
                )}

                <div className="ticker-wrap flex-1 overflow-hidden whitespace-nowrap relative flex items-center h-full px-4">
                    <div className="ticker-content flex gap-12 text-[11px] font-body font-medium items-center text-text-main h-full">
                        {realItems ? (
                            realItems.map((coin, i) => (
                                <span key={i} className="flex gap-2 shrink-0 items-center">
                                    <div className="size-4 shrink-0 overflow-hidden rounded-sm">
                                        {coin.logo && <img src={coin.logo} alt={`${coin.symbol} logo`} className="w-full h-full object-contain" />}
                                    </div>
                                    <span className="opacity-70">{coin.symbol}:</span>
                                    <span className="font-bold">{coin.price}</span>
                                    <span className={`font-bold ${coin.isUp ? 'text-green-600' : 'text-red-500'}`}>
                                        {coin.isUp ? '▲' : '▼'} {coin.change.replace(/[+-]/, '')}
                                    </span>
                                </span>
                            ))
                        ) : (
                            skeletonItems.map((sym, i) => (
                                <span key={i} className="flex gap-2 shrink-0 items-center">
                                    <div className="size-4 shrink-0 rounded-sm bg-gray-100 animate-pulse" />
                                    <span className="opacity-50">{sym}:</span>
                                    <span className="inline-block w-16 h-3 rounded-sm bg-gray-100 animate-pulse" />
                                    <span className="inline-block w-10 h-3 rounded-sm bg-gray-100 animate-pulse" />
                                </span>
                            ))
                        )}
                    </div>
                </div>

                {/* Windows controls - integrated into right side */}
                {!isMac && (
                    <div className="shrink-0 flex items-center h-full no-drag">
                        <WindowControls />
                    </div>
                )}
            </div>
        </div>
    );
};
