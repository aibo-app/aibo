import { db } from '../index';
import { alerts, wallets } from '../db/schema';
import { desc, eq } from 'drizzle-orm';
import { PortfolioService } from './PortfolioService';

export type AlertType = 'price_change' | 'large_transfer' | 'security' | 'portfolio_milestone' | 'gas_price' | 'news';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
    id: number;
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    description: string;
    metadata?: any;
    isRead: boolean;
    createdAt: number;
}

// 30-minute cooldown per symbol to prevent duplicate alerts
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;

export class AlertService {
    private static lastPrices: Record<string, number> = {};
    private static lastAlertTime: Record<string, number> = {};
    private static lastGasAlertTime = 0;
    private static lastKnownTxSignatures = new Set<string>();
    private static initialTxLoadDone = false;

    /**
     * Create a new alert
     */
    static async createAlert(
        type: AlertType,
        severity: AlertSeverity,
        title: string,
        description: string,
        metadata?: any
    ): Promise<void> {
        try {
            await db.insert(alerts).values({
                type,
                severity,
                title,
                description,
                metadata: metadata ? JSON.stringify(metadata) : null,
                isRead: 0,
                createdAt: Date.now()
            });

            console.log(`[Alert] Created ${severity} alert: ${title}`);
        } catch (error) {
            console.error('[Alert] Failed to create alert:', error);
        }
    }

    /**
     * Get recent alerts
     */
    static async getAlerts(limit: number = 20, unreadOnly: boolean = false): Promise<Alert[]> {
        try {
            let query = db
                .select()
                .from(alerts)
                .orderBy(desc(alerts.createdAt))
                .limit(limit);

            if (unreadOnly) {
                query = query.where(eq(alerts.isRead, 0)) as any;
            }

            const results = await query;

            return results.map(a => ({
                id: a.id,
                type: a.type as AlertType,
                severity: a.severity as AlertSeverity,
                title: a.title,
                description: a.description,
                metadata: a.metadata ? JSON.parse(a.metadata) : undefined,
                isRead: a.isRead === 1,
                createdAt: a.createdAt
            }));
        } catch (error) {
            console.error('[Alert] Failed to get alerts:', error);
            return [];
        }
    }

    /**
     * Get unread alert count
     */
    static async getUnreadCount(): Promise<number> {
        try {
            const results = await db
                .select()
                .from(alerts)
                .where(eq(alerts.isRead, 0));
            return results.length;
        } catch {
            return 0;
        }
    }

    /**
     * Mark alert as read
     */
    static async markAsRead(alertId: number): Promise<void> {
        try {
            await db.update(alerts)
                .set({ isRead: 1 })
                .where(eq(alerts.id, alertId));
        } catch (error) {
            console.error('[Alert] Failed to mark alert as read:', error);
        }
    }

    /**
     * Mark all alerts as read
     */
    static async markAllAsRead(): Promise<void> {
        try {
            await db.update(alerts)
                .set({ isRead: 1 })
                .where(eq(alerts.isRead, 0));
        } catch (error) {
            console.error('[Alert] Failed to mark all alerts as read:', error);
        }
    }

    /**
     * Check if an alert is on cooldown for a given key (prevents duplicates)
     */
    private static isOnCooldown(key: string): boolean {
        const lastTime = this.lastAlertTime[key];
        if (!lastTime) return false;
        return (Date.now() - lastTime) < ALERT_COOLDOWN_MS;
    }

    private static setCooldown(key: string): void {
        this.lastAlertTime[key] = Date.now();
    }

    /**
     * Monitor for price volatility — checks user's actual portfolio symbols + defaults
     */
    static async checkPriceAlerts(): Promise<void> {
        // Build symbol list from user's actual holdings
        const symbols = await this.getPortfolioSymbols();

        for (const symbol of symbols) {
            try {
                const stats = await PortfolioService.getAssetStats(symbol);
                if (!stats || !stats.price) continue;

                const currentPrice = stats.price;
                const lastPrice = this.lastPrices[symbol];

                // First check for this symbol: seed the price, no alert
                if (lastPrice === undefined) {
                    this.lastPrices[symbol] = currentPrice;
                    continue;
                }

                const changePercent = ((currentPrice - lastPrice) / lastPrice) * 100;

                // Alert on 5%+ moves with cooldown
                if (Math.abs(changePercent) >= 5 && !this.isOnCooldown(`price:${symbol}`)) {
                    await this.createAlert(
                        'price_change',
                        Math.abs(changePercent) >= 10 ? 'critical' : 'warning',
                        `${symbol} ${changePercent > 0 ? 'Surge' : 'Drop'} Alert`,
                        `${symbol} moved ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}% to $${currentPrice.toFixed(2)}`,
                        { symbol, oldPrice: lastPrice, newPrice: currentPrice, changePercent }
                    );
                    this.setCooldown(`price:${symbol}`);
                }

                this.lastPrices[symbol] = currentPrice;
            } catch (error) {
                // Silently skip — individual symbol failure shouldn't break the loop
            }
        }
    }

    /**
     * Get unique symbols from the user's portfolio + always include BTC/ETH/SOL
     */
    private static async getPortfolioSymbols(): Promise<string[]> {
        const baseSymbols = new Set(['BTC', 'ETH', 'SOL']);

        try {
            const userWallets = await db.select().from(wallets);
            if (userWallets.length > 0) {
                const portfolio = await PortfolioService.getAggregatedPortfolio(
                    userWallets.map(w => ({ address: w.address, chainType: w.chainType as 'evm' | 'solana' }))
                );
                if (portfolio?.assets) {
                    for (const asset of portfolio.assets) {
                        if (asset.symbol && asset.value > 1) { // Only track assets worth > $1
                            baseSymbols.add(asset.symbol.toUpperCase());
                        }
                    }
                }
            }
        } catch {
            // Fall back to defaults
        }

        return Array.from(baseSymbols);
    }

    /**
     * Monitor gas prices and alert on congestion (with cooldown)
     */
    static async checkGasAlerts(): Promise<void> {
        try {
            const globalStats = await PortfolioService.getGlobalStats();
            if (!globalStats || !globalStats.gasPrice) return;

            const gasPrice = globalStats.gasPrice;

            // Alert on high gas (>50 gwei) with 30-min cooldown
            if (gasPrice > 50 && (Date.now() - this.lastGasAlertTime) > ALERT_COOLDOWN_MS) {
                await this.createAlert(
                    'gas_price',
                    gasPrice > 100 ? 'critical' : 'warning',
                    'High Gas Price Alert',
                    `Network congestion detected. Gas price at ${gasPrice} gwei. Consider delaying transactions.`,
                    { gasPrice }
                );
                this.lastGasAlertTime = Date.now();
            }
        } catch {
            // Silently skip
        }
    }

    /**
     * Monitor for large transfers by comparing transaction snapshots.
     * On first run, seeds the known set. On subsequent runs, detects new large txs.
     */
    static async checkTransferAlerts(): Promise<void> {
        try {
            const userWallets = await db.select().from(wallets);
            if (userWallets.length === 0) return;

            const transactions = await PortfolioService.getRecentTransactions(
                userWallets.map(w => ({ address: w.address, chainType: w.chainType }))
            );

            if (!transactions || transactions.length === 0) return;

            // First run: seed the known set, don't alert
            if (!this.initialTxLoadDone) {
                for (const tx of transactions) {
                    if (tx.signature) this.lastKnownTxSignatures.add(tx.signature);
                }
                this.initialTxLoadDone = true;
                return;
            }

            // Detect new transactions — alert on ALL of them
            for (const tx of transactions) {
                if (!tx.signature || this.lastKnownTxSignatures.has(tx.signature)) continue;
                this.lastKnownTxSignatures.add(tx.signature);

                const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
                const value = tx.value || 0;
                const isIncoming = tx.type === 'receive' || tx.type === 'airdrop';
                const isSwap = tx.type === 'swap';
                const isLarge = value > 500 || amount > 10000;

                // Build description based on tx type
                let title: string;
                let desc: string;
                if (isSwap && tx.swapDetails) {
                    title = 'Swap Detected';
                    desc = tx.swapDetails.label || `Swapped ${amount} ${tx.symbol}`;
                } else {
                    title = isLarge
                        ? `Large ${isIncoming ? 'Incoming' : 'Outgoing'} Transfer`
                        : `${isIncoming ? 'Incoming' : 'Outgoing'} Transfer`;
                    desc = `${amount} ${tx.symbol} ${isIncoming ? 'received' : 'sent'}${value ? ` (~$${value.toFixed(0)})` : ''}`;
                }

                await this.createAlert(
                    'large_transfer',
                    isLarge ? (value > 5000 ? 'critical' : 'warning') : 'info',
                    title,
                    desc,
                    { signature: tx.signature, symbol: tx.symbol, amount, value, type: tx.type }
                );
            }

            // Cap the known set to prevent memory growth (keep last 500)
            if (this.lastKnownTxSignatures.size > 500) {
                const arr = Array.from(this.lastKnownTxSignatures);
                this.lastKnownTxSignatures = new Set(arr.slice(-300));
            }
        } catch {
            // Silently skip
        }
    }

    /**
     * Start automated alert monitoring
     */
    static startMonitoring(intervalMinutes: number = 5): NodeJS.Timeout {
        console.log(`[Alert] Starting alert monitoring (every ${intervalMinutes} minutes)`);

        // Delay initial check by 15s to let services initialize
        setTimeout(() => {
            this.checkPriceAlerts();
            this.checkGasAlerts();
            this.checkTransferAlerts();
        }, 15000);

        // Schedule recurring checks
        return setInterval(async () => {
            await this.checkPriceAlerts();
            await this.checkGasAlerts();
            await this.checkTransferAlerts();
        }, intervalMinutes * 60 * 1000);
    }

    /**
     * Get formatted alerts for display (with time ago)
     */
    static async getFormattedAlerts(limit: number = 10): Promise<any[]> {
        const alertList = await this.getAlerts(limit);

        return alertList.map(alert => {
            const minutesAgo = Math.floor((Date.now() - alert.createdAt) / 60000);
            let timeAgo: string;

            if (minutesAgo < 1) timeAgo = 'Just now';
            else if (minutesAgo < 60) timeAgo = `${minutesAgo}m`;
            else if (minutesAgo < 1440) timeAgo = `${Math.floor(minutesAgo / 60)}h`;
            else timeAgo = `${Math.floor(minutesAgo / 1440)}d`;

            const iconMap: Record<AlertType, string> = {
                price_change: 'trending_up',
                large_transfer: 'swap_horiz',
                security: 'shield',
                portfolio_milestone: 'stars',
                gas_price: 'local_gas_station',
                news: 'newspaper'
            };

            const colorMap: Record<AlertSeverity, string> = {
                info: 'blue',
                warning: 'orange',
                critical: 'red'
            };

            return {
                id: alert.id,
                icon: iconMap[alert.type] || 'notifications',
                title: alert.title,
                desc: alert.description,
                color: colorMap[alert.severity],
                time: timeAgo,
                isRead: alert.isRead
            };
        });
    }
}
