import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import * as dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import { createClient } from '@deepgram/sdk';
import { PortfolioService } from './services/PortfolioService';
import { AIProfilingService } from './services/AIProfilingService';
import { HighFrequencyRefresher } from './services/HighFrequencyRefresher';
import { TokenRegistryService } from './services/TokenRegistryService';
import { CacheService } from './services/CacheService';
import { HeliusWebhookService } from './services/HeliusWebhookService';
import { BaseNewTokenDetector } from './services/BaseNewTokenDetector';
import { TransactionPollService } from './services/TransactionPollService';
import { db } from './db';
import { tokens, prices, wallets, transactions } from './db/schema';
import { eq, and, or, inArray, desc } from 'drizzle-orm';

const fastify = Fastify({
    logger: { level: 'error' },
});

fastify.register(cors, {
    origin: true,
});

// Raw audio body parsers for voice transcription
fastify.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_req: any, body: any, done: any) => { done(null, body); });
fastify.addContentTypeParser('audio/webm', { parseAs: 'buffer' }, (_req: any, body: any, done: any) => { done(null, body); });

// Rate limiting to protect against abuse
fastify.register(rateLimit, {
    max: 100, // 100 requests
    timeWindow: '1 minute',
    cache: 10000, // Track up to 10k unique IPs
    skipOnError: true, // Don't block on rate limit errors
});

// --- Simple Authentication Middleware ---
fastify.addHook('preHandler', async (request, reply) => {
    const token = request.headers['x-team-token'];
    const expectedToken = process.env.TEAM_TOKEN || 'aibo_secure_token';

    // Skip auth for public endpoints and OpenClaw proxy
    const publicPaths = ['/health', '/chat/completions', '/v1/chat/completions'];
    if (publicPaths.includes(request.url)) return;

    if (token !== expectedToken) {
        return reply.code(401).send({ error: 'Unauthorized: Invalid Team Token' });
    }
});

// --- Health Check ---
fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});

// --- API Rate Limit Monitoring ---
fastify.get('/v1/api-stats', async () => {
    const { BirdeyeService } = await import('./services/BirdeyeService');
    return {
        birdeye: BirdeyeService.getStats(),
        message: 'Rate limits are client-side enforced to protect free tiers',
        timestamp: new Date().toISOString()
    };
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

// --- Transactions Endpoint (DB-first, instant) ---
// Reads from Postgres (populated by TransactionPollService every 60s).
// If DB is empty for these wallets, kicks off a one-time live fetch.
fastify.post('/v1/transactions', async (request: any, reply) => {
    const { wallets: reqWallets } = request.body;
    if (!reqWallets || !Array.isArray(reqWallets)) return reply.code(400).send({ error: 'Missing wallets' });

    const addresses = reqWallets.map((w: any) => w.address);
    if (addresses.length === 0) return [];

    try {
        // Fast path: read from Postgres
        const dbTxs = await db.select()
            .from(transactions)
            .where(inArray(transactions.walletAddress, addresses))
            .orderBy(desc(transactions.timestamp))
            .limit(500);

        if (dbTxs.length > 0) {
            // Map DB rows to the expected response format
            return dbTxs.map(tx => {
                let extra: any = {};
                try { extra = tx.rawData ? JSON.parse(tx.rawData) : {}; } catch { }
                return {
                    wallet: tx.walletAddress,
                    walletAddress: tx.walletAddress,
                    type: tx.type,
                    amount: tx.amount,
                    symbol: tx.symbol,
                    value: tx.valueUsd || 0,
                    time: new Date(tx.timestamp * 1000).toLocaleTimeString(),
                    status: tx.status,
                    signature: tx.signature,
                    timestamp: tx.timestamp * 1000,
                    chain: tx.chain,
                    label: extra.label,
                    swapDetails: extra.swapDetails,
                };
            });
        }

        // Cold start: no data yet, do a one-time live fetch (slow but only once)
        console.log('[Transactions] No cached data, performing initial live fetch...');
        const txs = await PortfolioService.getRecentTransactions(reqWallets);
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

fastify.get('/v1/market/global', async () => {
    return await PortfolioService.getGlobalStats();
});

// --- Asset Metadata (Deep Cache) ---
fastify.get('/v1/metadata/:chain/:address', async (request: any, reply) => {
    const { chain, address } = request.params;

    try {
        const token = await db.query.tokens.findFirst({
            where: and(eq(tokens.id, address), eq(tokens.chain, chain.toUpperCase()))
        });

        const price = await db.query.prices.findFirst({
            where: and(eq(prices.tokenAddress, address), eq(prices.chain, chain.toUpperCase()))
        });

        if (!token) {
            return reply.code(404).send({ error: 'Metadata not yet indexed. Will be available after next refresh cycle.' });
        }

        return { ...token, priceInfo: price || null };
    } catch (e) {
        fastify.log.error(e);
        return reply.code(500).send({ error: 'Metadata query failed' });
    }
});

// --- Asset Profiling (AI Behavioral Analysis) ---
fastify.get('/v1/profile/:address', async (request: any, reply) => {
    const { address } = request.params;
    fastify.log.info({ msg: 'Profiling Request', address });
    try {
        const profile = await AIProfilingService.profileWallet(address);
        return profile;
    } catch (e) {
        fastify.log.error({ msg: 'Profiling Failed', error: (e as any).message, stack: (e as any).stack });
        return reply.code(500).send({ error: 'Profiling failed' });
    }
});

// --- Webhooks for Real-time streaming ---
// Helius Enhanced Webhooks: https://docs.helius.dev/webhooks-and-websockets/webhooks
fastify.post('/v1/webhooks/helius', async (request: any, reply) => {
    try {
        // Verify signature if HELIUS_WEBHOOK_SECRET is configured
        const signature = request.headers['x-helius-signature'] as string;
        const webhookSecret = process.env.HELIUS_WEBHOOK_SECRET;

        if (webhookSecret && signature) {
            const rawBody = JSON.stringify(request.body);
            const isValid = HeliusWebhookService.verifySignature(rawBody, signature, webhookSecret);
            if (!isValid) {
                fastify.log.warn('Invalid Helius webhook signature');
                return reply.code(401).send({ error: 'Invalid signature' });
            }
        }

        // Process webhook events
        const events = Array.isArray(request.body) ? request.body : [request.body];
        await HeliusWebhookService.processWebhook(events);

        return { status: 'processed', count: events.length };
    } catch (e) {
        fastify.log.error({ error: (e as any).message }, 'Helius webhook processing failed');
        return reply.code(500).send({ error: 'Processing failed' });
    }
});

// Legacy webhook endpoint (kept for backwards compatibility)
fastify.post('/v1/webhooks/chain', async (request: any, reply) => {
    const data: any = request.body;
    fastify.log.info({ msg: 'Generic Chain Signal Received', data });
    return { status: 'ingested' };
});

// --- OpenAI-Compatible Chat Completions Proxy (for OpenClaw) ---
const handleChatCompletions = async (request: any, reply: any) => {
    const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
    if (!DEEPSEEK_KEY) {
        return reply.code(500).send({ error: 'DeepSeek API key not configured in backend-team' });
    }

    try {
        // Forward the entire request body to DeepSeek (OpenAI-compatible)
        const response = await axios.post('https://api.deepseek.com/v1/chat/completions', request.body, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_KEY}`,
                'Content-Type': 'application/json'
            },
            responseType: request.body.stream ? 'stream' : 'json'
        });

        // If streaming, pipe the response
        if (request.body.stream) {
            reply.header('Content-Type', 'text/event-stream');
            return reply.send(response.data);
        }

        // Otherwise return the full response
        return response.data;
    } catch (e: any) {
        console.error('[Backend-Team] Chat completions proxy failed:', e.message);
        return reply.code(500).send({ error: 'Chat completions proxy failed', details: e.message });
    }
};

// Register both with and without /v1 prefix (OpenClaw uses different formats)
fastify.post('/v1/chat/completions', handleChatCompletions);
fastify.post('/chat/completions', handleChatCompletions);

// --- Simple Chat Service Proxy (for voice assistant) ---
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

// --- Voice Transcription (Deepgram) ---
// Pre-create client once (saves ~100-200ms per call)
const deepgramClient = process.env.DEEPGRAM_API_KEY ? createClient(process.env.DEEPGRAM_API_KEY) : null;

fastify.post('/v1/transcribe', async (request: any, reply) => {
    if (!deepgramClient) {
        return reply.code(500).send({ error: 'Deepgram API key not configured' });
    }

    try {
        const audioBuffer = request.body as Buffer;
        if (!audioBuffer || audioBuffer.length === 0) {
            return reply.code(400).send({ error: 'No audio data received' });
        }

        // Validate WebM/EBML magic bytes (0x1A 0x45 0xDF 0xA3)
        const hasValidHeader = audioBuffer.length >= 4 &&
            audioBuffer[0] === 0x1A && audioBuffer[1] === 0x45 &&
            audioBuffer[2] === 0xDF && audioBuffer[3] === 0xA3;

        if (!hasValidHeader) {
            console.warn(`🎤 [Deepgram] Invalid WebM header! First 8 bytes: ${audioBuffer.subarray(0, 8).toString('hex')} | Size: ${audioBuffer.length}`);
            return reply.code(400).send({ error: 'Invalid audio data: not a valid WebM file' });
        }

        console.log(`🎤 [Deepgram] Valid WebM | ${audioBuffer.length} bytes | Header: ${audioBuffer.subarray(0, 4).toString('hex')}`);

        const { result } = await deepgramClient.listen.prerecorded.transcribeFile(audioBuffer, {
            model: 'nova-2',
            smart_format: true,
            language: 'en',
            mimetype: 'audio/webm',
        });

        const alt = result?.results?.channels?.[0]?.alternatives?.[0];
        const transcript = alt?.transcript || '';
        const confidence = alt?.confidence || 0;

        console.log(`🎤 [Deepgram] Transcript: "${transcript}" | Confidence: ${confidence} | Audio: ${audioBuffer.length} bytes`);

        return { transcript, confidence };
    } catch (e: any) {
        fastify.log.error(e.message);
        return reply.code(500).send({ error: 'Transcription failed', details: e.message });
    }
});

// --- Market Intelligence (Global Prices) — Pure DB read ---
fastify.get('/v1/price/:symbol', async (request: any, reply) => {
    const symbol = request.params.symbol.toUpperCase();

    // Find the token by symbol or address
    const token = await db.query.tokens.findFirst({
        where: or(eq(tokens.symbol, symbol), eq(tokens.id, symbol))
    });

    const targetAddress = token ? token.id : symbol;

    try {
        const priceData = await db.query.prices.findFirst({
            where: or(
                eq(prices.tokenAddress, targetAddress),
                eq(prices.tokenAddress, targetAddress.toUpperCase())
            )
        });

        if (!priceData) {
            // Fire-and-forget: queue background discovery for next request
            TokenRegistryService.discoverAndRegister(symbol).catch(() => { });
            return reply.code(404).send({ error: `Asset ${symbol} not yet indexed. Queued for discovery.` });
        }

        const finalLogo = (token?.logo && token.logo !== token.id)
            ? token.logo
            : `https://ui-avatars.com/api/?name=${token?.symbol || symbol}&background=random`;

        return {
            symbol: token?.symbol || symbol,
            price: priceData.price || 0,
            change24h: priceData.priceChange24h || 0,
            volume24h: priceData.volume24h || 0,
            mcap: priceData.mcap || 0,
            fdv: priceData.fdv || priceData.mcap || 0,
            liquidity: priceData.liquidity || 0,
            logo: finalLogo,
            createdAt: token?.createdAt || null,
            updatedAt: priceData.updatedAt
        };
    } catch (e) {
        fastify.log.error(e);
        return reply.code(500).send({ error: 'Market query failed' });
    }
});

// --- BASE TOKEN DISCOVERY ENDPOINTS ---

// Get newly created tokens on Base (all launchpads)
fastify.get('/v1/base/new-tokens', async (request: any, reply) => {
    const { limit = 50, minLiquidity = 0, maxAgeHours = 24 } = request.query;

    try {
        const newTokens = await BaseNewTokenDetector.getNewTokens({
            limit: parseInt(limit),
            minLiquidity: parseFloat(minLiquidity),
            maxAgeHours: parseFloat(maxAgeHours)
        });

        return {
            count: newTokens.length,
            tokens: newTokens,
            filters: {
                limit: parseInt(limit),
                minLiquidity: parseFloat(minLiquidity),
                maxAgeHours: parseFloat(maxAgeHours)
            }
        };
    } catch (e) {
        fastify.log.error(e);
        return reply.code(500).send({ error: 'Failed to fetch new Base tokens' });
    }
});

// Get trending new tokens on Base
fastify.get('/v1/base/trending', async (request: any, reply) => {
    const { limit = 20 } = request.query;

    try {
        const trending = await BaseNewTokenDetector.getTrendingNewTokens(parseInt(limit));

        return {
            count: trending.length,
            tokens: trending.map(t => ({
                ...t,
                trendingScore: Math.round(t.trendingScore * 100) / 100 // Round for display
            }))
        };
    } catch (e) {
        fastify.log.error(e);
        return reply.code(500).send({ error: 'Failed to fetch trending tokens' });
    }
});

// Get Clanker tokens (AI-launched)
fastify.get('/v1/base/clanker', async (request: any, reply) => {
    try {
        const clankerTokens = await BaseNewTokenDetector.getClankerTokens();

        return {
            count: clankerTokens.length,
            tokens: clankerTokens,
            launchpad: 'Clanker (AI-launched tokens)'
        };
    } catch (e) {
        fastify.log.error(e);
        return reply.code(500).send({ error: 'Failed to fetch Clanker tokens' });
    }
});

// Get Virtuals Protocol tokens
fastify.get('/v1/base/virtuals', async (request: any, reply) => {
    try {
        const virtualsTokens = await BaseNewTokenDetector.getVirtualsTokens();

        return {
            count: virtualsTokens.length,
            tokens: virtualsTokens,
            launchpad: 'Virtuals Protocol'
        };
    } catch (e) {
        fastify.log.error(e);
        return reply.code(500).send({ error: 'Failed to fetch Virtuals tokens' });
    }
});

// Enrich token metadata from multiple sources
fastify.get('/v1/base/tokens/:address/enrich', async (request: any, reply) => {
    const { address } = request.params;

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return reply.code(400).send({ error: 'Invalid Base token address' });
    }

    try {
        const metadata = await BaseNewTokenDetector.enrichTokenMetadata(address);

        if (!metadata) {
            return reply.code(404).send({
                error: 'Token metadata not found',
                address,
                suggestion: 'Token may be too new or not listed on any DEX yet'
            });
        }

        return metadata;
    } catch (e) {
        fastify.log.error(e);
        return reply.code(500).send({ error: 'Failed to enrich token metadata' });
    }
});

// --- Real-time Wallet Support ---
fastify.post('/v1/wallets/track', async (request: any, reply) => {
    const { address, chain, label } = request.body;

    if (!address || !chain) {
        return reply.code(400).send({ error: 'Missing address or chain' });
    }

    try {
        db.insert(wallets).values({
            address,
            chain: chain.toUpperCase(),
            label: label || null,
            lastChecked: 0
        }).onConflictDoUpdate({
            target: wallets.address,
            set: { lastChecked: 0 } // Force a refresh
        }).catch(e => {
            if (!e.message.includes('TIMEOUT')) console.error(`[WalletTrack] DB Error: ${e.message}`);
        });

        // Trigger immediate sync
        PortfolioService.getRecentTransactions([{
            address,
            chainType: chain.toLowerCase() as 'evm' | 'solana',
            label: label || undefined
        }]).catch(e => console.error(`[WalletTrack] Immediate sync failed for ${address}:`, e));

        return { success: true, message: `Wallet ${address} is now being tracked for real-time history.` };
    } catch (e) {
        fastify.log.error(e);
        return reply.code(500).send({ error: 'Failed to track wallet' });
    }
});

const PORT = 4000; // Team backend runs on 4000 to avoid conflict with local 3001

// Performance monitoring — only flag genuinely slow requests (>15s)
// Blockchain API calls routinely take 2-7s which is normal
fastify.addHook('onRequest', async (request) => {
    (request as any).startTime = Date.now();
});

fastify.addHook('onResponse', async (request) => {
    const duration = Date.now() - ((request as any).startTime || Date.now());
    if (duration > 15000) {
        console.warn(`[Backend] Slow: ${request.method} ${request.url} took ${(duration / 1000).toFixed(1)}s`);
    }
});

const start = async () => {
    try {
        // Initialize Redis cache
        CacheService.initialize();

        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`📡 Aibō Team Backend running at http://localhost:${PORT}`);
        console.log('⏳ Deferring heavy background services by 15s to allow fast app startup...');

        // Defer ALL heavy services to allow instant window display
        // Frontend will show cached data, then these services populate fresh data in background
        setTimeout(() => {
            console.log('🚀 Starting background services...');

            // Start High-Frequency Global Token Registry Refresher
            HighFrequencyRefresher.start(30000); // 30-second sync loop

            // Start Background Transaction Sync Loop
            TransactionPollService.start();
        }, 15000); // 15 second delay — enough for UI to render with cache

        // Graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('SIGTERM received, shutting down gracefully...');
            await CacheService.shutdown();
            await fastify.close();
            process.exit(0);
        });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
