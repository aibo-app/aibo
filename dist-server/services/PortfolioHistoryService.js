"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortfolioHistoryService = void 0;
const index_1 = require("../index");
const schema_1 = require("../db/schema");
const PortfolioService_1 = require("./PortfolioService");
const drizzle_orm_1 = require("drizzle-orm");
class PortfolioHistoryService {
    /**
     * Take a snapshot of the current portfolio state
     */
    static async takeSnapshot() {
        try {
            // Get all wallets
            const storedWallets = await index_1.db.select().from(schema_1.wallets);
            if (storedWallets.length === 0) {
                console.log('[PortfolioHistory] No wallets to snapshot');
                return;
            }
            const mappedWallets = storedWallets.map(w => ({
                address: w.address,
                chainType: w.chainType,
                label: w.label || undefined
            }));
            // Fetch current portfolio
            const portfolio = await PortfolioService_1.PortfolioService.getAggregatedPortfolio(mappedWallets);
            const timestamp = Date.now();
            // Store portfolio snapshot
            await index_1.db.insert(schema_1.portfolioSnapshots).values({
                totalValue: portfolio.totalValue.toString(),
                totalChange24h: portfolio.totalChange24h.toString(),
                assetsJson: JSON.stringify(portfolio.assets),
                timestamp,
                createdAt: timestamp
            });
            // Store individual asset history in a single batch insert
            if (portfolio.assets.length > 0) {
                await index_1.db.insert(schema_1.assetHistory).values(portfolio.assets.map((asset) => ({
                    symbol: asset.symbol,
                    chain: asset.chain,
                    balance: asset.balance.toString(),
                    value: asset.value.toString(),
                    price: asset.price.toString(),
                    timestamp,
                    createdAt: timestamp
                })));
            }
            console.log(`[PortfolioHistory] Snapshot saved: $${portfolio.totalValue.toFixed(2)}`);
        }
        catch (error) {
            console.error('[PortfolioHistory] Failed to take snapshot:', error);
        }
    }
    /**
     * Get portfolio history for a time range
     * @param hours Number of hours to look back (default: 24)
     */
    static async getHistory(hours = 24) {
        const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
        const snapshots = await index_1.db
            .select()
            .from(schema_1.portfolioSnapshots)
            .where((0, drizzle_orm_1.gte)(schema_1.portfolioSnapshots.timestamp, cutoffTime))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.portfolioSnapshots.timestamp));
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
    static async getAssetHistory(symbol, hours = 24) {
        const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
        const history = await index_1.db
            .select()
            .from(schema_1.assetHistory)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.assetHistory.symbol, symbol), (0, drizzle_orm_1.gte)(schema_1.assetHistory.timestamp, cutoffTime)))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.assetHistory.timestamp));
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
    static startAutoSnapshot(intervalMinutes = 15) {
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
    static async cleanup() {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        try {
            await index_1.db.delete(schema_1.portfolioSnapshots).where((0, drizzle_orm_1.lt)(schema_1.portfolioSnapshots.timestamp, sevenDaysAgo));
            await index_1.db.delete(schema_1.assetHistory).where((0, drizzle_orm_1.lt)(schema_1.assetHistory.timestamp, sevenDaysAgo));
            console.log('[PortfolioHistory] Cleanup: deleted snapshots older than 7 days');
        }
        catch (error) {
            console.error('[PortfolioHistory] Cleanup failed:', error);
        }
    }
}
exports.PortfolioHistoryService = PortfolioHistoryService;
