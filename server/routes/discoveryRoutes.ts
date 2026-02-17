import { FastifyInstance } from 'fastify';
import { backendTeamClient } from '../services/BackendTeamClient';

export default async function discoveryRoutes(fastify: FastifyInstance) {
    /**
     * Get aggregated alpha discovery data
     */
    let alphaCache: { data: any; time: number } | null = null;
    fastify.get('/api/discovery/alpha', async () => {
        // 30s cache for trending data
        if (alphaCache && Date.now() - alphaCache.time < 30_000) return alphaCache.data;

        const trending = await backendTeamClient.getTrendingNewTokens(20);
        const data = { trending, clanker: [], virtuals: [] };
        alphaCache = { data, time: Date.now() };
        return data;
    });

    /**
     * Get trending tokens
     */
    fastify.get('/api/discovery/trending', async (request: any) => {
        const limit = parseInt(request.query.limit) || 20;
        return await backendTeamClient.getTrendingNewTokens(limit);
    });

    /**
     * Get Clanker tokens
     */
    fastify.get('/api/discovery/clanker', async () => {
        return await backendTeamClient.getClankerTokens();
    });
}
