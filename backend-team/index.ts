import Fastify from 'fastify';
import cors from '@fastify/cors';
import * as dotenv from 'dotenv';
import axios from 'axios';
import { PortfolioService } from './services/PortfolioService';

dotenv.config();

const fastify = Fastify({
    logger: true,
});

fastify.register(cors, {
    origin: true,
});

// --- Portfolio Retrieval Endpoint ---
fastify.post('/v1/portfolio', async (request: any, reply) => {
    const { wallets } = request.body;
    if (!wallets || !Array.isArray(wallets)) {
        return reply.code(400).send({ error: 'Missing or invalid wallets array' });
    }

    try {
        const data = await PortfolioService.getAggregatedPortfolio(wallets);
        return data;
    } catch (e) {
        fastify.log.error(e);
        return reply.code(500).send({ error: 'Failed to fetch portfolio from chain' });
    }
});

// --- Transactions Indexing Endpoint ---
fastify.post('/v1/transactions', async (request: any, reply) => {
    const { wallets } = request.body;
    if (!wallets || !Array.isArray(wallets)) return reply.code(400).send({ error: 'Missing wallets' });

    try {
        const txs = await PortfolioService.getRecentTransactions(wallets);
        return txs;
    } catch (e) {
        fastify.log.error(e);
        return reply.code(500).send({ error: 'Failed to fetch transactions' });
    }
});

// --- Market Data ---
fastify.get('/v1/markets/top', async () => {
    return await PortfolioService.getTopMarkets(20);
});

// --- Chat Service Proxy ---
fastify.post('/v1/chat/query', async (request: any, reply) => {
    const { transcript } = request.body;

    // In production, keys live ONLY on the Team Backend
    const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
    if (!DEEPSEEK_KEY) {
        return reply.code(500).send({ error: 'Team Chat API not configured' });
    }

    try {
        const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
            model: "deepseek-chat",
            messages: [{ role: "user", content: transcript }]
        }, {
            headers: { 'Authorization': `Bearer ${DEEPSEEK_KEY}` }
        });

        return { response: response.data.choices[0].message.content };
    } catch (e: any) {
        fastify.log.error(e.message);
        return reply.code(500).send({ error: 'Team Chat Proxy failed', details: e.message });
    }
});

const PORT = 4000; // Team backend runs on 4000 to avoid conflict with local 3001

const start = async () => {
    try {
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`📡 Aibō Team Backend running at http://localhost:${PORT}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
