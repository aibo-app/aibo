import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import * as dotenv from 'dotenv';
dotenv.config();
import * as BetterSqlite3 from 'better-sqlite3';
const Database = (BetterSqlite3 as any).default || BetterSqlite3;
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as schema from './db/schema';
import walletRoutes from './routes/walletRoutes';
import portfolioRoutes from './routes/portfolioRoutes';
import settingsRoutes from './routes/settingsRoutes';
import axios from 'axios';
import { OpenClawClient } from './services/OpenClawClient';
import { BrainManager } from './services/BrainManager';
import { PortfolioService } from './services/PortfolioService';
// import { TranscriptionService } from './services/TranscriptionService'; // Removed local STT

// Configuration
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const DB_PATH = path.join(__dirname, '../data/aibo.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize Database
const sqlite = new Database(DB_PATH);
export const db = drizzle(sqlite, { schema });

// Initialize Fastify
const fastify = Fastify({
    logger: { level: 'error' },
});

// Setup Plugins
fastify.register(cors, {
    origin: true, // For development
});
fastify.register(multipart, {
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit for audio files
        fieldSize: 10 * 1024 * 1024,
    }
});
fastify.register(websocket);

// Voice/Data WebSocket Bridge
fastify.register(async function (fastify) {
    fastify.get('/ws/voice', { websocket: true }, (connection, req) => {
        const socket = (connection as any).socket || connection;
        const clientId = Math.random().toString(36).substring(7);
        console.log(`[WS] Client connected: ${clientId}`);

        // Subscribe to Agent Actions and forward to Frontend
        const actionHandler = (action: any) => {
            if (socket.readyState === 1) { // OPEN
                socket.send(JSON.stringify(action));
            }
        };

        const client = OpenClawClient.getInstance();
        client.addActionListener(actionHandler);

        socket.on('message', (message: any) => {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'body_state') {
                    client.updateBodyState(data.state);
                }
            } catch (e) {
                console.error('[WS] Failed to parse message:', e);
            }
        });

        socket.on('close', () => {
            console.log(`[WS] Client disconnected: ${clientId}`);
            // Note: In a real EventEmmiter we'd removeListener here, 
            // but our simple array in OpenClawClient doesn't support removal yet.
            // Since this is a singleton array and clients are few, it's acceptable for now,
            // but strictly speaking a memory leak. 
            // TODO: Refactor OpenClawClient to use official EventEmitter for proper cleanup.
        });
    });
});

// --- Register Routes ---
fastify.register(walletRoutes);
fastify.register(portfolioRoutes);
fastify.register(settingsRoutes);

// Health check
fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});

fastify.get('/api/health/diagnostics', async () => {
    const openClawClient = OpenClawClient.getInstance();

    return {
        timestamp: new Date().toISOString(),
        services: {
            brainGateway: {
                status: openClawClient.isConnected ? '🟢 CONNECTED' : '🔴 DISCONNECTED',
                details: openClawClient.isConnected ? 'OpenClaw Brain Linked' : 'Attempting reconnection...'
            },
            teamBackend: {
                status: '📡 DELEGATED',
                details: 'RPC and AI tasks proxied to Team Backend'
            }
        }
    };
});

// --- AI Query Proxy ---
// Bridges the front-end fetch to the Team Backend for secure key usage
fastify.post('/api/ai/query', async (request: any, reply) => {
    const { transcript } = request.body;
    if (!transcript) {
        return reply.code(400).send({ error: 'Missing transcript' });
    }

    try {
        console.log(`📡 [AI Proxy] Delegating to Team Backend: "${transcript}"`);
        const TEAM_BACKEND_URL = process.env.TEAM_BACKEND_URL || 'http://localhost:4000';
        const response = await axios.post(`${TEAM_BACKEND_URL}/v1/chat/query`, { transcript });

        return { response: response.data.response };
    } catch (e: any) {
        console.error('[AI Proxy] Failed to query Team Backend:', e.message);
        // Fallback to local Brain if Team Backend is unavailable
        try {
            console.log('⚠️ [AI Proxy] Team Backend unavailable, falling back to local Brain...');
            const response = await OpenClawClient.getInstance().sendMessage(transcript);
            return { response };
        } catch (localErr) {
            return reply.code(500).send({ error: 'All AI services unavailable' });
        }
    }
});



const openClawUrl = process.env.OPENCLAW_GATEWAY_URL || 'ws://localhost:18789';


fastify.get('/api/openclaw/status', async () => {
    return {
        connected: OpenClawClient.getInstance().isConnected,
        url: openClawUrl
    };
});



// Start Server
const start = async () => {
    try {
        console.log('🤖 Aibō initializing core systems... [v1.2.3-JIT]');

        // Start Embedded Brain (OpenClaw Gateway)
        // Non-blocking: allow port 3001 to start immediately
        BrainManager.getInstance().start().catch(e => {
            console.error('❌ Failed to start Embedded Brain:', e);
        });

        // Start OpenClaw Client
        try {
            console.log(`🦞 Initializing OpenClaw Client (${openClawUrl})...`);
            const client = OpenClawClient.getInstance(openClawUrl);
            client.connect();
        } catch (e) {
            console.warn('⚠️ OpenClaw Client failed to start:', e);
        }

        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`🚀 Aibō Backend running at http://localhost:${PORT}`);
    } catch (err: any) {
        if (err.code === 'EADDRINUSE') {
            console.error(`❌ FATAL: Port ${PORT} is already in use.`);
            console.error(`💡 Tip: Run 'lsof -t -i :${PORT} | xargs kill -9' to clear it.`);
            process.exit(1);
        }
        fastify.log.error(err);
        process.exit(1);
    }
};


start();
