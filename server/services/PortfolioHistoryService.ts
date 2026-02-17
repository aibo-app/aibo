import { db } from '../index';
import { portfolioSnapshots, assetHistory, wallets } from '../db/schema';
import { PortfolioService } from './PortfolioService';
import { and, desc, eq, gte, lt } from 'drizzle-orm';

export interface PortfolioSnapshot {
    id: number;
    totalValue: number;
    totalChange24h: number;
    assets: any[];
    timestamp: number;
    createdAt: number;
}

export interface AssetHistoryPoint {
    symbol: string;
    chain: string;
    balance: number;
    value: number;
    price: number;
    timestamp: number;
}

export class PortfolioHistoryService {
    /**
     * Take a snapshot of the current portfolio state
     */
    static async takeSnapshot(): Promise<void> {
        try {
            // Get all wallets
            const storedWallets = await db.select().from(wallets);
            if (storedWallets.length === 0) {
                console.log('[PortfolioHistory] No wallets to snapshot');
                return;
            }

            const mappedWallets = storedWallets.map(w => ({
                address: w.address,
                chainType: w.chainType as 'evm' | 'solana',
                label: w.label || undefined
            }));

            // Fetch current portfolio
            const portfolio = await PortfolioService.getAggregatedPortfolio(mappedWallets);

            const timestamp = Date.now();

            // Store portfolio snapshot
            await db.insert(portfolioSnapshots).values({
                totalValue: portfolio.totalValue.toString(),
                totalChange24h: portfolio.totalChange24h.toString(),
                assetsJson: JSON.stringify(portfolio.assets),
                timestamp,
                createdAt: timestamp
            });

            // Store individual asset history in a single batch insert
            if (portfolio.assets.length > 0) {
                await db.insert(assetHistory).values(
                    portfolio.assets.map((asset: any) => ({
                        symbol: asset.symbol,
                        chain: asset.chain,
                        balance: asset.balance.toString(),
                        value: asset.value.toString(),
                        price: asset.price.toString(),
                        timestamp,
                        createdAt: timestamp
                    }))
                );
            }

            console.log(`[PortfolioHistory] Snapshot saved: $${portfolio.totalValue.toFixed(2)}`);
        } catch (error) {
            console.error('[PortfolioHistory] Failed to take snapshot:', error);
        }
    }

    /**
     * Get portfolio history for a time range
     * @param hours Number of hours to look back (default: 24)
     */
    static async getHistory(hours: number = 24): Promise<PortfolioSnapshot[]> {
        const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);

        const snapshots = await db
            .select()
            .from(portfolioSnapshots)
            .where(gte(portfolioSnapshots.timestamp, cutoffTime))
            .orderBy(desc(portfolioSnapshots.timestamp));

        return snapshots.map(s => ({
            id: s.id,
            totalValue: parseFloat(s.totalValue),
            totalChange24h: parseFloat(s.totalChange24h),
            assets: JSON.parse(s.assetsJson),
            timestamp: s.timestamp,
            createdAt: s.createdAt
        }));
    }

    /**
     * Get asset-specific history for charting
     * @param symbol Asset symbol (e.g., 'SOL', 'ETH')
     * @param hours Number of hours to look back
     */
    static async getAssetHistory(symbol: string, hours: number = 24): Promise<AssetHistoryPoint[]> {
        const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);

        const history = await db
            .select()
            .from(assetHistory)
            .where(and(
                eq(assetHistory.symbol, symbol),
                gte(assetHistory.timestamp, cutoffTime)
            ))
            .orderBy(desc(assetHistory.timestamp));

        return history
            .map(h => ({
                symbol: h.symbol,
                chain: h.chain,
                balance: parseFloat(h.balance),
                value: parseFloat(h.value),
                price: parseFloat(h.price),
                timestamp: h.timestamp
            }));
    }

    /**
     * Start automatic snapshot service
     * Takes snapshots every N minutes
     */
    static startAutoSnapshot(intervalMinutes: number = 15): NodeJS.Timeout {
        console.log(`[PortfolioHistory] Starting auto-snapshot (every ${intervalMinutes} minutes, first in 2min)`);

        // Delay first snapshot — backend-team needs time to be ready with fresh data
        // Taking a snapshot immediately blocks the server with 20s timeout calls
        setTimeout(() => this.takeSnapshot(), 120000);

        // Schedule recurring snapshots with periodic cleanup
        let snapshotCount = 0;
        return setInterval(() => {
            this.takeSnapshot();
            snapshotCount++;
            // Run cleanup every ~96 snapshots (24 hours at 15-min intervals)
            if (snapshotCount % 96 === 0) {
                this.cleanup();
            }
        }, intervalMinutes * 60 * 1000);
    }

    /**
     * Clean up old snapshots to prevent database bloat
     * Deletes data older than 7 days
     */
    static async cleanup(): Promise<void> {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        try {
            await db.delete(portfolioSnapshots).where(lt(portfolioSnapshots.timestamp, sevenDaysAgo));
            await db.delete(assetHistory).where(lt(assetHistory.timestamp, sevenDaysAgo));
            console.log('[PortfolioHistory] Cleanup: deleted snapshots older than 7 days');
        } catch (error) {
            console.error('[PortfolioHistory] Cleanup failed:', error);
        }
    }
}
