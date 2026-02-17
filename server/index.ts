import Fastify from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import * as dotenv from 'dotenv';
dotenv.config();
import * as BetterSqlite3 from 'better-sqlite3';
const Database = (BetterSqlite3 as any).default || BetterSqlite3;
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import * as schema from './db/schema';
import walletRoutes from './routes/walletRoutes';
import portfolioRoutes from './routes/portfolioRoutes';
import settingsRoutes from './routes/settingsRoutes';
import alertRoutes from './routes/alertRoutes';
import historyRoutes from './routes/historyRoutes';
import chatRoutes from './routes/chatRoutes';
import skillRoutes from './routes/skillRoutes';
import discoveryRoutes from './routes/discoveryRoutes';
import channelRoutes from './routes/channelRoutes';
import cronRoutes from './routes/cronRoutes';
import rulesRoutes from './routes/rulesRoutes';
import { OpenClawClient } from './services/OpenClawClient';
import { BrainManager } from './services/BrainManager';
import { ChatService } from './services/ChatService';
import { backendTeamClient } from './services/BackendTeamClient';
import { PortfolioService } from './services/PortfolioService';
import { PortfolioHistoryService } from './services/PortfolioHistoryService';
import { AlertService } from './services/AlertService';
import { CryptoNewsService } from './services/CryptoNewsService';

// Configuration
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
// In production (packaged Electron), AIBO_DATA_DIR points to userData/data
// In dev, fall back to <project>/data/
const DB_PATH = process.env.AIBO_DATA_DIR
    ? path.join(process.env.AIBO_DATA_DIR, 'aibo.db')
    : path.join(__dirname, '../data/aibo.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize Database
const sqlite = new Database(DB_PATH);
export const db = drizzle(sqlite, { schema });

// Auto-migration: ensure ALL tables exist (critical for fresh installs on Windows/Mac/Linux)
sqlite.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER REFERENCES conversations(id),
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
    CREATE TABLE IF NOT EXISTS wallets (
        address TEXT PRIMARY KEY,
        chain_type TEXT NOT NULL DEFAULT 'evm',
        label TEXT,
        added_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_value TEXT NOT NULL,
        total_change_24h TEXT NOT NULL,
        assets_json TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
    CREATE TABLE IF NOT EXISTS asset_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        chain TEXT NOT NULL,
        balance TEXT NOT NULL,
        value TEXT NOT NULL,
        price TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_asset_history_symbol_timestamp
    ON asset_history(symbol, timestamp DESC);
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        metadata TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON alerts(is_read, created_at DESC);
    CREATE TABLE IF NOT EXISTS transactions (
        signature TEXT PRIMARY KEY,
        wallet_address TEXT NOT NULL,
        chain TEXT NOT NULL,
        type TEXT NOT NULL,
        symbol TEXT NOT NULL,
        amount TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        status TEXT NOT NULL,
        label TEXT,
        raw_data TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC);
    CREATE TABLE IF NOT EXISTS rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
    CREATE TABLE IF NOT EXISTS rule_artifacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id INTEGER NOT NULL REFERENCES rules(id),
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        output_path TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        compiled_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_rule_artifacts_rule_id ON rule_artifacts(rule_id);
`);

// Initialize Fastify — logger disabled (app uses console.error for real errors,
// Fastify's built-in logger just spams "premature close" noise from aborted requests)
const fastify = Fastify({ logger: false });

// Setup Plugins
fastify.register(cors, {
    origin: [
        'http://localhost:5173',   // Vite dev server
        'http://localhost:3001',   // Self
        /^file:\/\//,              // Electron production (file:// protocol)
        /^http:\/\/localhost:/,    // Any localhost port
    ],
});
fastify.register(compress, { global: true }); // gzip all JSON responses
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
            client.removeActionListener(actionHandler);
        });
    });
});

// --- Register Routes ---
fastify.register(walletRoutes);
fastify.register(portfolioRoutes);
fastify.register(settingsRoutes);
fastify.register(alertRoutes);
fastify.register(historyRoutes);
fastify.register(chatRoutes);
fastify.register(skillRoutes);
fastify.register(discoveryRoutes);
fastify.register(channelRoutes);
fastify.register(cronRoutes);
fastify.register(rulesRoutes);

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

// --- AI Query Endpoint ---
// Routes chat queries through OpenClaw Brain (which has access to skills and node commands)
// This is the CORRECT pattern for an OpenClaw wrapper - Brain handles all AI interactions
fastify.post('/api/ai/query', async (request: any, reply) => {
    const { transcript } = request.body;
    if (!transcript) {
        return reply.code(400).send({ error: 'Missing transcript' });
    }

    try {
        console.log(`🧠 [AI Query] Routing to OpenClaw Brain: "${transcript}"`);
        const chatService = ChatService.getInstance();
        const convo = await chatService.getOrCreateDailyConversation();
        const { assistantMsg } = await chatService.sendMessage(convo.id, transcript);
        return { response: assistantMsg.content, conversationId: convo.id };
    } catch (e: any) {
        console.error('[AI Query] Brain query failed:', e.message);
        return reply.code(500).send({ error: 'Brain unavailable. Please check OpenClaw connection.' });
    }
});

// --- Streaming AI + TTS Pipeline (SSE) ---
// Sends brain response as sentence-by-sentence TTS audio chunks
fastify.post('/api/ai/stream', async (request: any, reply) => {
    const { transcript, voice } = request.body as { transcript: string; voice?: string };
    if (!transcript || !transcript.trim()) {
        return reply.code(400).send({ error: 'Missing transcript' });
    }

    // Hijack response for SSE streaming
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    });

    const sendEvent = (data: any) => {
        try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch { }
    };

    try {
        sendEvent({ type: 'thinking' });

        console.log(`🧠 [AI Stream] Routing to Brain: "${transcript}"`);
        const chatService = ChatService.getInstance();
        const convo = await chatService.getOrCreateDailyConversation();
        // Voice brevity hint — brain sees the instruction, chat history stores clean transcript
        const voiceHint = `${transcript}\n\n(This is a voice conversation. Reply in 3-5 short spoken sentences. No markdown, no bullet points, no emojis, no numbered lists. Keep it natural and conversational.)`;
        const { assistantMsg } = await chatService.sendMessage(convo.id, transcript, voiceHint);

        const responseText = assistantMsg.content;
        if (!responseText || !responseText.trim()) {
            sendEvent({ type: 'done', fullText: '' });
            res.end();
            return;
        }

        // Clean markdown/emojis, then split into sentences for TTS
        // Brevity is now handled by the voice hint sent to the brain — no server-side truncation
        const cleanedText = cleanTextForSpeech(responseText);
        const selectedVoice = voice || 'en-US-AnaNeural';
        const sentences = splitIntoSentences(cleanedText);
        console.log(`🔊 [AI Stream] Synthesizing ${sentences.length} sentence(s) in parallel...`);

        const ttsPromises = sentences.map(s =>
            synthesizeSpeech(s, selectedVoice).catch(err => {
                console.error(`[AI Stream] TTS failed for: "${s.substring(0, 40)}": ${err.message}`);
                return null;
            })
        );

        // Stream audio chunks in sentence order
        for (let i = 0; i < sentences.length; i++) {
            const audioBuffer = await ttsPromises[i];
            if (audioBuffer && audioBuffer.length > 0) {
                sendEvent({ type: 'audio', text: sentences[i], audio: audioBuffer.toString('base64') });
            }
        }

        sendEvent({ type: 'done', fullText: responseText });
    } catch (err: any) {
        console.error('[AI Stream] Pipeline failed:', err.message);
        sendEvent({ type: 'error', message: 'Brain unavailable' });
    }

    res.end();
});


// --- Voice Transcription Endpoint ---
fastify.post('/api/voice/transcribe', async (request: any, reply) => {
    try {
        const file = await request.file();
        if (!file) {
            return reply.code(400).send({ error: 'No audio file uploaded' });
        }

        const chunks: Buffer[] = [];
        for await (const chunk of file.file) {
            chunks.push(chunk);
        }
        const audioBuffer = Buffer.concat(chunks);

        if (audioBuffer.length < 1024) {
            return reply.code(400).send({ error: 'Audio too short' });
        }

        console.log(`🎤 [Voice] Sending ${audioBuffer.length} bytes to Deepgram...`);
        const result = await backendTeamClient.transcribe(audioBuffer);
        console.log(`🎤 [Voice] Transcript: "${result.transcript}" (confidence: ${result.confidence})`);
        return result;
    } catch (e: any) {
        console.error('[Voice] Transcription failed:', e.message);
        return reply.code(500).send({ error: 'Transcription failed', details: e.message });
    }
});

// --- Combined Voice → AI endpoint (skip browser roundtrip) ---
fastify.post('/api/voice/ask', async (request: any, reply) => {
    try {
        const file = await request.file();
        if (!file) {
            return reply.code(400).send({ error: 'No audio file uploaded' });
        }

        const chunks: Buffer[] = [];
        for await (const chunk of file.file) {
            chunks.push(chunk);
        }
        const audioBuffer = Buffer.concat(chunks);

        if (audioBuffer.length < 1024) {
            return reply.code(400).send({ error: 'Audio too short' });
        }

        // Step 1: Transcribe
        console.log(`🎤 [Voice] Sending ${audioBuffer.length} bytes to Deepgram...`);
        const { transcript, confidence } = await backendTeamClient.transcribe(audioBuffer);
        console.log(`🎤 [Voice] Transcript: "${transcript}" (confidence: ${confidence})`);

        if (!transcript || !transcript.trim()) {
            return { transcript: '', response: '' };
        }

        // Step 2: Persist and send to Brain via ChatService
        console.log(`🧠 [Voice→AI] Routing to Brain: "${transcript}"`);
        const chatService = ChatService.getInstance();
        const convo = await chatService.getOrCreateDailyConversation();
        const { assistantMsg } = await chatService.sendMessage(convo.id, transcript);

        return { transcript, confidence, response: assistantMsg.content, conversationId: convo.id };
    } catch (e: any) {
        console.error('[Voice→AI] Pipeline failed:', e.message);
        return reply.code(500).send({ error: 'Voice pipeline failed', details: e.message });
    }
});

// --- Edge TTS Endpoint (optimized: in-memory, no file I/O) ---
let _EdgeTTSClass: any = null;
async function getEdgeTTSClass() {
    if (!_EdgeTTSClass) {
        const mod = await import('node-edge-tts');
        _EdgeTTSClass = mod.EdgeTTS;
    }
    return _EdgeTTSClass;
}
// Pre-warm the import at startup
getEdgeTTSClass().catch(() => { });

// Strip markdown formatting and emojis so TTS reads clean spoken text
function cleanTextForSpeech(raw: string): string {
    return raw
        // Remove emoji characters (Unicode emoji ranges)
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')
        // Remove markdown bold/italic (**, *, __)
        .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
        .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
        // Remove markdown headers (# ## ###)
        .replace(/^#{1,6}\s+/gm, '')
        // Remove markdown bullet points (- or *)
        .replace(/^[\s]*[-*]\s+/gm, '')
        // Remove markdown links [text](url) → text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Remove inline code backticks
        .replace(/`([^`]+)`/g, '$1')
        // Collapse multiple spaces/newlines
        .replace(/\n{2,}/g, '. ')
        .replace(/\n/g, ', ')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

// Synthesize speech from text using Edge TTS (reusable helper)
async function synthesizeSpeech(text: string, voice: string = 'en-US-AnaNeural'): Promise<Buffer> {
    const EdgeTTS = await getEdgeTTSClass();
    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) return Buffer.alloc(0);

    const tts = new EdgeTTS({ voice });
    const ws = await tts._connectWebSocket();
    const audioChunks: Buffer[] = [];

    return new Promise<Buffer>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('TTS timed out')), 15000);

        ws.on('message', (data: Buffer, isBinary: boolean) => {
            if (isBinary) {
                const separator = 'Path:audio\r\n';
                const idx = data.indexOf(separator) + separator.length;
                audioChunks.push(data.subarray(idx));
            } else {
                const msg = data.toString();
                if (msg.includes('Path:turn.end')) {
                    clearTimeout(timeout);
                    ws.close();
                    resolve(Buffer.concat(audioChunks));
                }
            }
        });

        ws.on('error', (err: Error) => { clearTimeout(timeout); reject(err); });

        const crypto = require('node:crypto');
        const requestId = crypto.randomBytes(16).toString('hex');
        ws.send(
            `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n` +
            `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">` +
            `<voice name="${voice}">` +
            `<prosody rate="+20%" pitch="default" volume="default">` +
            `${cleanText.replace(/[<>&"']/g, (c: string) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c] || c))}` +
            `</prosody></voice></speak>`
        );
    });
}

// Split text into natural sentence chunks for streaming TTS
function splitIntoSentences(text: string): string[] {
    // PROTECT: Float numbers (e.g. 45.43, 0.5, 1.0.2)
    // Replace dots in numbers with a placeholder using lookaround to handle overlaps
    const protectedText = text.replace(/(?<=\d)\.(?=\d)/g, '<DOT>');

    const raw = protectedText.match(/[^.!?]*[.!?]+[\s]?|[^.!?]+$/g) || [protectedText];
    const sentences = raw.map(s => s.trim()).filter(s => s.length > 0);

    // Merge very short fragments (< 15 chars) with previous sentence
    const merged: string[] = [];
    for (const s of sentences) {
        if (merged.length > 0 && s.length < 15) {
            merged[merged.length - 1] += ' ' + s;
        } else {
            merged.push(s);
        }
    }

    const final = merged.length > 0 ? merged : [text.trim()];

    // RESTORE: Replace placeholder back to dots
    return final.map(s => s.replace(/<DOT>/g, '.'));
}

fastify.post('/api/tts/speak', async (request: any, reply) => {
    const { text, voice } = request.body as { text: string; voice?: string };

    if (!text || !text.trim()) {
        return reply.code(400).send({ error: 'Missing text parameter' });
    }

    try {
        const selectedVoice = voice || 'en-US-AnaNeural';
        console.log(`🔊 [TTS] Generating speech: "${text.substring(0, 80)}..." (voice: ${selectedVoice})`);
        const audioBuffer = await synthesizeSpeech(text, selectedVoice);
        reply.header('Content-Type', 'audio/mpeg');
        return reply.send(audioBuffer);
    } catch (e: any) {
        console.error('[TTS] Speech generation failed:', e.message);
        return reply.code(500).send({ error: 'TTS failed', details: e.message });
    }
});

// Use 127.0.0.1 (not "localhost") — gateway binds to IPv4, macOS resolves localhost to ::1 (IPv6)
const openClawUrl = process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789';

/** Probe a TCP port until it accepts connections (or timeout) */
async function waitForPort(port: number, maxWaitMs = 30000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        const open = await new Promise<boolean>(resolve => {
            const sock = new net.Socket();
            sock.setTimeout(1000);
            sock.once('connect', () => { sock.destroy(); resolve(true); });
            sock.once('error', () => { sock.destroy(); resolve(false); });
            sock.once('timeout', () => { sock.destroy(); resolve(false); });
            sock.connect(port, '127.0.0.1');
        });
        if (open) return true;
        await new Promise(r => setTimeout(r, 1000));
    }
    return false;
}


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

        // Start server FIRST to make API endpoints available immediately
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`🚀 Aibō Backend running at http://localhost:${PORT}`);

        const isDev = process.env.NODE_ENV === 'development';

        // Defer brain startup briefly to let API endpoints become available first
        setTimeout(async () => {
            // Start Embedded Brain (OpenClaw Gateway) — WAIT for it before connecting client
            console.log('🧠 Starting Brain (this may take 30-60s on first run)...');
            try {
                await BrainManager.getInstance().start();
            } catch (e) {
                console.error('❌ Failed to start Embedded Brain:', e);
            }

            // Wait for the gateway port to actually accept TCP connections
            const portReady = await waitForPort(18789, 30000);
            if (portReady) {
                console.log(`🦞 Port 18789 open — connecting OpenClaw Client...`);
            } else {
                console.warn('⚠️ Port 18789 not open after 30s — connecting anyway (reconnect loop will retry)');
            }

            try {
                const client = OpenClawClient.getInstance(openClawUrl);
                client.connect();
            } catch (e) {
                console.warn('⚠️ OpenClaw Client failed to start:', e);
            }
        }, isDev ? 5000 : 2000);

        // Defer ALL background services to avoid blocking startup
        // These services call backend-team (port 4000) which may not be ready yet
        // and each call has 15-20s timeouts that block the event loop
        let snapshotInterval: NodeJS.Timeout;
        let alertInterval: NodeJS.Timeout;

        console.log('⏳ Deferring background services by 30s to allow fast startup...');
        setTimeout(() => {
            console.log('🔄 Starting background services (snapshot, alerts, news)...');
            snapshotInterval = PortfolioHistoryService.startAutoSnapshot(15);
            alertInterval = AlertService.startMonitoring(5);
            CryptoNewsService.start();
        }, 30000); // 30s delay — UI is long visible by then

        // Sync existing wallets + pre-warm portfolio cache
        // Delay 45s to let backend-team finish starting + first refresh
        setTimeout(async () => {
            try {
                const allWallets = await db.select().from(schema.wallets);
                console.log(`[WalletSync] Syncing ${allWallets.length} existing wallets for tracking...`);
                for (const w of allWallets) {
                    await backendTeamClient.trackWallet(w.address, w.chainType, w.label || undefined)
                        .catch(() => { }); // Silent — will sync on next data refresh
                }

                // Pre-warm portfolio cache so first brain query is instant
                if (allWallets.length > 0) {
                    const mapped = allWallets.map(w => ({
                        address: w.address,
                        chainType: w.chainType as 'evm' | 'solana'
                    }));
                    await PortfolioService.getAggregatedPortfolio(mapped).catch(() => { });
                    console.log('[Startup] Portfolio cache pre-warmed');
                }
            } catch { }
        }, 45000);

        // Graceful shutdown handler
        const shutdown = async (signal: string) => {
            console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);
            if (snapshotInterval) clearInterval(snapshotInterval);
            if (alertInterval) clearInterval(alertInterval);
            CryptoNewsService.stop();
            try { BrainManager.getInstance().stop(); } catch { }
            try { await fastify.close(); } catch { }
            try { sqlite.close(); } catch { }
            console.log('[Server] Shutdown complete.');
            process.exit(0);
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (err: any) {
        if (err.code === 'EADDRINUSE') {
            console.error(`❌ FATAL: Port ${PORT} is already in use.`);
            console.error(`💡 Tip: Run 'lsof -t -i :${PORT} | xargs kill -9' to clear it.`);
            process.exit(1);
        }
        console.error('❌ FATAL:', err);
        process.exit(1);
    }
};


start();
