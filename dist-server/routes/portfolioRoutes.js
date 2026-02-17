"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = portfolioRoutes;
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const index_1 = require("../index");
const PortfolioService_1 = require("../services/PortfolioService");
async function portfolioRoutes(fastify) {
    /**
     * GET /api/portfolio
     * Aggregates real-time data for all tracked wallets
     */
    fastify.get('/api/portfolio', async (request, reply) => {
        try {
            // 1. Get wallets from DB
            const userWallets = await index_1.db.select().from(schema_1.wallets);
            if (userWallets.length === 0) {
                return { assets: [], totalValue: 0 };
            }
            // 2. Fetch real-time data
            const formattedWallets = userWallets.map(w => ({
                ...w,
                chainType: (w.chainType === 'solana' ? 'solana' : 'evm')
            }));
            const data = await PortfolioService_1.PortfolioService.getAggregatedPortfolio(formattedWallets);
            return data;
        }
        catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error' });
        }
    });
    /**
     * GET /api/prices
     * Proxy for real-time market data
     */
    fastify.get('/api/prices', async () => {
        return await PortfolioService_1.PortfolioService.getPrices(['BTC', 'ETH', 'SOL', 'XRP', 'LINK', 'AVAX', 'ARB', 'MATIC']);
    });
    /**
     * GET /api/assets/:id
     * Returns detailed stats for a specific asset
     */
    fastify.get('/api/assets/:id', async (request, reply) => {
        const { id } = request.params;
        const stats = await PortfolioService_1.PortfolioService.getAssetStats(id);
        if (!stats)
            return reply.code(404).send({ error: 'Asset not found' });
        return stats;
    });
    /**
     * GET /api/transactions
     * Returns recent transactions for all tracked wallets
     */
    // Transaction cache — 15s TTL, avoids hammering backend-team on every poll
    let txCache = null;
    fastify.get('/api/transactions', async () => {
        if (txCache && Date.now() - txCache.time < 15_000)
            return txCache.data;
        const userWallets = await index_1.db.select().from(schema_1.wallets);
        const txs = await PortfolioService_1.PortfolioService.getRecentTransactions(userWallets);
        // Strip rawData from response — frontend doesn't need it, saves ~90% bandwidth
        const slim = txs.map(({ rawData, ...rest }) => rest);
        txCache = { data: slim, time: Date.now() };
        return slim;
    });
    // Global stats cache — 60s TTL (data changes slowly)
    let globalCache = null;
    fastify.get('/api/global', async () => {
        if (globalCache && Date.now() - globalCache.time < 60_000)
            return globalCache.data;
        const data = await PortfolioService_1.PortfolioService.getGlobalStats();
        globalCache = { data, time: Date.now() };
        return data;
    });
    // Market trends cache — 30s TTL
    let trendsCache = null;
    fastify.get('/api/market/trends', async () => {
        if (trendsCache && Date.now() - trendsCache.time < 30_000)
            return trendsCache.data;
        const data = await PortfolioService_1.PortfolioService.getTopMarkets();
        trendsCache = { data, time: Date.now() };
        return data;
    });
    fastify.get('/api/market/movers', async () => {
        return PortfolioService_1.PortfolioService.getTopMovers();
    });
    /**
     * GET /api/wallets/:address/portfolio
     * Returns portfolio data for a specific wallet
     */
    fastify.get('/api/wallets/:address/portfolio', async (request, reply) => {
        const { address } = request.params;
        try {
            const wallet = await index_1.db.select().from(schema_1.wallets).where((0, drizzle_orm_1.eq)(schema_1.wallets.address, address)).limit(1);
            if (!wallet.length)
                return reply.code(404).send({ error: 'Wallet not found' });
            const formattedWallet = wallet.map(w => ({
                ...w,
                chainType: (w.chainType === 'solana' ? 'solana' : 'evm')
            }));
            return await PortfolioService_1.PortfolioService.getAggregatedPortfolio(formattedWallet);
        }
        catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error' });
        }
    });
    /**
     * GET /api/wallets/:address/transactions
     * Returns recent transactions for a specific wallet
     */
    fastify.get('/api/wallets/:address/transactions', async (request, reply) => {
        const { address } = request.params;
        try {
            const wallet = await index_1.db.select().from(schema_1.wallets).where((0, drizzle_orm_1.eq)(schema_1.wallets.address, address)).limit(1);
            if (!wallet.length)
                return reply.code(404).send({ error: 'Wallet not found' });
            return await PortfolioService_1.PortfolioService.getRecentTransactions(wallet);
        }
        catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error' });
        }
    });
}
