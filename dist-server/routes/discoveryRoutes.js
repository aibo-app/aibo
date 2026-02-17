"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = discoveryRoutes;
const BackendTeamClient_1 = require("../services/BackendTeamClient");
async function discoveryRoutes(fastify) {
    /**
     * Get aggregated alpha discovery data
     */
    let alphaCache = null;
    fastify.get('/api/discovery/alpha', async () => {
        // 60s cache — Base token data doesn't change every second
        if (alphaCache && Date.now() - alphaCache.time < 60_000)
            return alphaCache.data;
        const [trending, clanker, virtuals] = await Promise.all([
            BackendTeamClient_1.backendTeamClient.getTrendingNewTokens(10),
            BackendTeamClient_1.backendTeamClient.getClankerTokens(),
            BackendTeamClient_1.backendTeamClient.getVirtualsTokens(),
        ]);
        const data = { trending, clanker, virtuals };
        alphaCache = { data, time: Date.now() };
        return data;
    });
    /**
     * Get trending tokens
     */
    fastify.get('/api/discovery/trending', async (request) => {
        const limit = parseInt(request.query.limit) || 20;
        return await BackendTeamClient_1.backendTeamClient.getTrendingNewTokens(limit);
    });
    /**
     * Get Clanker tokens
     */
    fastify.get('/api/discovery/clanker', async () => {
        return await BackendTeamClient_1.backendTeamClient.getClankerTokens();
    });
}
