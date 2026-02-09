import { FastifyInstance } from 'fastify';
import { wallets } from '../db/schema';
import { eq } from 'drizzle-orm';
import { db } from '../index';
import { PortfolioService } from '../services/PortfolioService';

export default async function portfolioRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/portfolio
     * Aggregates real-time data for all tracked wallets
     */
    fastify.get('/api/portfolio', async (request, reply) => {
        try {
            // 1. Get wallets from DB
            const userWallets = await db.select().from(wallets);

            if (userWallets.length === 0) {
                return { assets: [], totalValue: 0 };
            }

            // 2. Fetch real-time data
            const formattedWallets = userWallets.map(w => ({
                ...w,
                chainType: (w.chainType === 'solana' ? 'solana' : 'evm') as 'evm' | 'solana'
            }));
            const data = await PortfolioService.getAggregatedPortfolio(formattedWallets);

            return data;
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error' });
        }
    });

    /**
     * GET /api/prices
     * Proxy for real-time market data
     */
    fastify.get('/api/prices', async () => {
        return await PortfolioService.getPrices(['BTC', 'ETH', 'SOL', 'XRP', 'LINK', 'AVAX', 'ARB', 'MATIC']);
    });

    /**
     * GET /api/assets/:id
     * Returns detailed stats for a specific asset
     */
    fastify.get('/api/assets/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const stats = await PortfolioService.getAssetStats(id);
        if (!stats) return reply.code(404).send({ error: 'Asset not found' });
        return stats;
    });

    /**
     * GET /api/transactions
     * Returns recent transactions for all tracked wallets
     */
    fastify.get('/api/transactions', async () => {
        const userWallets = await db.select().from(wallets);
        return await PortfolioService.getRecentTransactions(userWallets);
    });

    fastify.get('/api/global', async () => {
        return PortfolioService.getGlobalStats();
    });

    fastify.get('/api/market/trends', async () => {
        return PortfolioService.getTopMarkets();
    });

    fastify.get('/api/market/movers', async () => {
        return PortfolioService.getTopMovers();
    });

    /**
     * GET /api/wallets/:address/portfolio
     * Returns portfolio data for a specific wallet
     */
    fastify.get('/api/wallets/:address/portfolio', async (request, reply) => {
        const { address } = request.params as { address: string };
        try {
            const wallet = await db.select().from(wallets).where(eq(wallets.address, address)).limit(1);
            if (!wallet.length) return reply.code(404).send({ error: 'Wallet not found' });

            const formattedWallet = wallet.map(w => ({
                ...w,
                chainType: (w.chainType === 'solana' ? 'solana' : 'evm') as 'evm' | 'solana'
            }));
            return await PortfolioService.getAggregatedPortfolio(formattedWallet);
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error' });
        }
    });

    /**
     * GET /api/wallets/:address/transactions
     * Returns recent transactions for a specific wallet
     */
    fastify.get('/api/wallets/:address/transactions', async (request, reply) => {
        const { address } = request.params as { address: string };
        try {
            const wallet = await db.select().from(wallets).where(eq(wallets.address, address)).limit(1);
            if (!wallet.length) return reply.code(404).send({ error: 'Wallet not found' });

            return await PortfolioService.getRecentTransactions(wallet);
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error' });
        }
    });
}
