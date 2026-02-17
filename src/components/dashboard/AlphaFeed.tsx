import React from 'react';
import { Panel, SectionTitle } from '../ui/Panel';
import { useData } from '../../hooks/useData';
import type { AlphaToken } from '../../types';

export const AlphaFeed: React.FC = () => {
    const { alphaData, loading } = useData();

    const renderToken = (token: AlphaToken) => (
        <div key={token.address} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-black/5 hover:border-primary/10 transition-all cursor-pointer group hover:translate-x-0.5">
            <div className="size-8 bg-white rounded-lg flex items-center justify-center shrink-0 border border-black/5 group-hover:scale-105 transition-transform overflow-hidden p-1">
                {token.logo ? (
                    <img src={token.logo} alt={token.symbol} className="w-full h-full object-contain" />
                ) : (
                    <div className="bg-primary/5 text-primary text-[10px] font-bold h-full w-full flex items-center justify-center">
                        {token.symbol.slice(0, 2)}
                    </div>
                )}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                    <p className="text-sm font-bold text-text-main tracking-tight truncate">{token.symbol}</p>
                    {token.chain && (
                        <span className={`text-[8px] font-bold px-1 py-0 rounded shrink-0 uppercase tracking-tighter ${token.chain === 'solana' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                            {token.chain === 'solana' ? 'SOL' : 'BASE'}
                        </span>
                    )}
                    {token.launchpadDetected && !token.chain && (
                        <span className="text-[8px] font-bold px-1 py-0 bg-purple-100 text-purple-600 rounded uppercase tracking-tighter shrink-0">
                            {token.launchpadDetected.split(' ')[0]}
                        </span>
                    )}
                    <span className={`text-[9px] font-semibold shrink-0 ml-auto ${token.priceChange24h >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(1)}%
                    </span>
                </div>
                <p className="text-[11px] text-text-main/50 font-medium leading-snug">
                    ${token.price < 0.01 ? token.price.toFixed(6) : token.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    {token.liquidity > 0 && <span className="text-text-muted/40"> · Liq ${(token.liquidity / 1000).toFixed(0)}k</span>}
                </p>
            </div>
        </div>
    );

    return (
        <Panel className="p-6 flex flex-col bg-white shadow-sm h-full overflow-hidden">
            <SectionTitle
                title="Aibō Alpha"
                icon="rocket_launch"
            />

            <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                <div>
                    <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-2 px-1">Trending</h4>
                    <div className="space-y-2">
                        {loading || alphaData.trending.length === 0 ? Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />
                        )) : (
                            alphaData.trending.slice(0, 20).map(renderToken)
                        )}
                    </div>
                </div>
            </div>
        </Panel>
    );
};
