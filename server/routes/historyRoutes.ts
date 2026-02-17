import { FastifyPluginAsync } from 'fastify';
import { PortfolioHistoryService } from '../services/PortfolioHistoryService';

const historyRoutes: FastifyPluginAsync = async (fastify) => {
    // Get portfolio history
    fastify.get('/api/portfolio/history', async (request: any, reply) => {
        const { hours = '24' } = request.query;
        const parsedHours = parseInt(hours) || 24;
        const history = await PortfolioHistoryService.getHistory(parsedHours);
        return { history };
    });

    // Get asset-specific history
    fastify.get('/api/portfolio/asset/:symbol/history', async (request: any, reply) => {
        const { symbol } = request.params;
        if (!symbol || typeof symbol !== 'string') return reply.code(400).send({ error: 'Invalid symbol' });
        const { hours = '24' } = request.query;
        const parsedHours = parseInt(hours) || 24;
        const history = await PortfolioHistoryService.getAssetHistory(symbol.toUpperCase(), parsedHours);
        return { symbol, history };
    });

    // Manually trigger snapshot (for testing)
    fastify.post('/api/portfolio/snapshot', async (request: any, reply) => {
        await PortfolioHistoryService.takeSnapshot();
        return { success: true, message: 'Snapshot created' };
    });
};

export default historyRoutes;
