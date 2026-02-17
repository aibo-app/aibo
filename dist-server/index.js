"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const compress_1 = __importDefault(require("@fastify/compress"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const BetterSqlite3 = __importStar(require("better-sqlite3"));
const Database = BetterSqlite3.default || BetterSqlite3;
const better_sqlite3_1 = require("drizzle-orm/better-sqlite3");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const net = __importStar(require("net"));
const schema = __importStar(require("./db/schema"));
const walletRoutes_1 = __importDefault(require("./routes/walletRoutes"));
const portfolioRoutes_1 = __importDefault(require("./routes/portfolioRoutes"));
const settingsRoutes_1 = __importDefault(require("./routes/settingsRoutes"));
const alertRoutes_1 = __importDefault(require("./routes/alertRoutes"));
const historyRoutes_1 = __importDefault(require("./routes/historyRoutes"));
const chatRoutes_1 = __importDefault(require("./routes/chatRoutes"));
const skillRoutes_1 = __importDefault(require("./routes/skillRoutes"));
const discoveryRoutes_1 = __importDefault(require("./routes/discoveryRoutes"));
const channelRoutes_1 = __importDefault(require("./routes/channelRoutes"));
const cronRoutes_1 = __importDefault(require("./routes/cronRoutes"));
const rulesRoutes_1 = __importDefault(require("./routes/rulesRoutes"));
const OpenClawClient_1 = require("./services/OpenClawClient");
const BrainManager_1 = require("./services/BrainManager");
const BackendTeamClient_1 = require("./services/BackendTeamClient");
const PortfolioHistoryService_1 = require("./services/PortfolioHistoryService");
const AlertService_1 = require("./services/AlertService");
const CryptoNewsService_1 = require("./services/CryptoNewsService");
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
exports.db = (0, better_sqlite3_1.drizzle)(sqlite, { schema });
// Auto-migration: ensure new tables exist on existing databases
sqlite.exec(`
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
const fastify = (0, fastify_1.default)({ logger: false });
// Setup Plugins
fastify.register(cors_1.default, {
    origin: [
        'http://localhost:5173', // Vite dev server
        'http://localhost:3001', // Self
        /^file:\/\//, // Electron production (file:// protocol)
        /^http:\/\/localhost:/, // Any localhost port
    ],
});
fastify.register(compress_1.default, { global: true }); // gzip all JSON responses
fastify.register(multipart_1.default, {
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit for audio files
        fieldSize: 10 * 1024 * 1024,
    }
});
fastify.register(websocket_1.default);
// Voice/Data WebSocket Bridge
fastify.register(async function (fastify) {
    fastify.get('/ws/voice', { websocket: true }, (connection, req) => {
        const socket = connection.socket || connection;
        const clientId = Math.random().toString(36).substring(7);
        console.log(`[WS] Client connected: ${clientId}`);
        // Subscribe to Agent Actions and forward to Frontend
        const actionHandler = (action) => {
            if (socket.readyState === 1) { // OPEN
                socket.send(JSON.stringify(action));
            }
        };
        const client = OpenClawClient_1.OpenClawClient.getInstance();
        client.addActionListener(actionHandler);
        socket.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'body_state') {
                    client.updateBodyState(data.state);
                }
            }
            catch (e) {
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
fastify.register(walletRoutes_1.default);
fastify.register(portfolioRoutes_1.default);
fastify.register(settingsRoutes_1.default);
fastify.register(alertRoutes_1.default);
fastify.register(historyRoutes_1.default);
fastify.register(chatRoutes_1.default);
fastify.register(skillRoutes_1.default);
fastify.register(discoveryRoutes_1.default);
fastify.register(channelRoutes_1.default);
fastify.register(cronRoutes_1.default);
fastify.register(rulesRoutes_1.default);
// Health check
fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});
fastify.get('/api/health/diagnostics', async () => {
    const openClawClient = OpenClawClient_1.OpenClawClient.getInstance();
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
fastify.post('/api/ai/query', async (request, reply) => {
    const { transcript } = request.body;
    if (!transcript) {
        return reply.code(400).send({ error: 'Missing transcript' });
    }
    try {
        console.log(`🧠 [AI Query] Routing to OpenClaw Brain: "${transcript}"`);
        const response = await OpenClawClient_1.OpenClawClient.getInstance().sendMessage(transcript);
        return { response };
    }
    catch (e) {
        console.error('[AI Query] Brain query failed:', e.message);
        return reply.code(500).send({ error: 'Brain unavailable. Please check OpenClaw connection.' });
    }
});
// --- Voice Transcription Endpoint ---
fastify.post('/api/voice/transcribe', async (request, reply) => {
    try {
        const file = await request.file();
        if (!file) {
            return reply.code(400).send({ error: 'No audio file uploaded' });
        }
        const chunks = [];
        for await (const chunk of file.file) {
            chunks.push(chunk);
        }
        const audioBuffer = Buffer.concat(chunks);
        if (audioBuffer.length < 1024) {
            return reply.code(400).send({ error: 'Audio too short' });
        }
        console.log(`🎤 [Voice] Sending ${audioBuffer.length} bytes to Deepgram...`);
        const result = await BackendTeamClient_1.backendTeamClient.transcribe(audioBuffer);
        console.log(`🎤 [Voice] Transcript: "${result.transcript}" (confidence: ${result.confidence})`);
        return result;
    }
    catch (e) {
        console.error('[Voice] Transcription failed:', e.message);
        return reply.code(500).send({ error: 'Transcription failed', details: e.message });
    }
});
// --- Combined Voice → AI endpoint (skip browser roundtrip) ---
fastify.post('/api/voice/ask', async (request, reply) => {
    try {
        const file = await request.file();
        if (!file) {
            return reply.code(400).send({ error: 'No audio file uploaded' });
        }
        const chunks = [];
        for await (const chunk of file.file) {
            chunks.push(chunk);
        }
        const audioBuffer = Buffer.concat(chunks);
        if (audioBuffer.length < 1024) {
            return reply.code(400).send({ error: 'Audio too short' });
        }
        // Step 1: Transcribe
        console.log(`🎤 [Voice] Sending ${audioBuffer.length} bytes to Deepgram...`);
        const { transcript, confidence } = await BackendTeamClient_1.backendTeamClient.transcribe(audioBuffer);
        console.log(`🎤 [Voice] Transcript: "${transcript}" (confidence: ${confidence})`);
        if (!transcript || !transcript.trim()) {
            return { transcript: '', response: '' };
        }
        // Step 2: Send directly to Brain (no browser roundtrip)
        console.log(`🧠 [Voice→AI] Routing to Brain: "${transcript}"`);
        const response = await OpenClawClient_1.OpenClawClient.getInstance().sendMessage(transcript);
        return { transcript, confidence, response };
    }
    catch (e) {
        console.error('[Voice→AI] Pipeline failed:', e.message);
        return reply.code(500).send({ error: 'Voice pipeline failed', details: e.message });
    }
});
// --- Edge TTS Endpoint (optimized: in-memory, no file I/O) ---
let _EdgeTTSClass = null;
async function getEdgeTTSClass() {
    if (!_EdgeTTSClass) {
        const mod = await Promise.resolve().then(() => __importStar(require('node-edge-tts')));
        _EdgeTTSClass = mod.EdgeTTS;
    }
    return _EdgeTTSClass;
}
// Pre-warm the import at startup
getEdgeTTSClass().catch(() => { });
fastify.post('/api/tts/speak', async (request, reply) => {
    const { text, voice } = request.body;
    if (!text || !text.trim()) {
        return reply.code(400).send({ error: 'Missing text parameter' });
    }
    try {
        const EdgeTTS = await getEdgeTTSClass();
        const selectedVoice = voice || 'en-US-AnaNeural';
        console.log(`🔊 [TTS] Generating speech: "${text.substring(0, 50)}..." (voice: ${selectedVoice})`);
        const tts = new EdgeTTS({ voice: selectedVoice });
        // Collect audio chunks in memory — no temp file needed
        const ws = await tts._connectWebSocket();
        const audioChunks = [];
        const audioBuffer = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('TTS timed out')), 15000);
            ws.on('message', (data, isBinary) => {
                if (isBinary) {
                    const separator = 'Path:audio\r\n';
                    const idx = data.indexOf(separator) + separator.length;
                    audioChunks.push(data.subarray(idx));
                }
                else {
                    const msg = data.toString();
                    if (msg.includes('Path:turn.end')) {
                        clearTimeout(timeout);
                        ws.close();
                        resolve(Buffer.concat(audioChunks));
                    }
                }
            });
            ws.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
            // Send SSML request
            const crypto = require('node:crypto');
            const requestId = crypto.randomBytes(16).toString('hex');
            ws.send(`X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n` +
                `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">` +
                `<voice name="${selectedVoice}">` +
                `<prosody rate="default" pitch="default" volume="default">` +
                `${text.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c] || c))}` +
                `</prosody></voice></speak>`);
        });
        reply.header('Content-Type', 'audio/mpeg');
        return reply.send(audioBuffer);
    }
    catch (e) {
        console.error('[TTS] Speech generation failed:', e.message);
        return reply.code(500).send({ error: 'TTS failed', details: e.message });
    }
});
// Use 127.0.0.1 (not "localhost") — gateway binds to IPv4, macOS resolves localhost to ::1 (IPv6)
const openClawUrl = process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789';
/** Probe a TCP port until it accepts connections (or timeout) */
async function waitForPort(port, maxWaitMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        const open = await new Promise(resolve => {
            const sock = new net.Socket();
            sock.setTimeout(1000);
            sock.once('connect', () => { sock.destroy(); resolve(true); });
            sock.once('error', () => { sock.destroy(); resolve(false); });
            sock.once('timeout', () => { sock.destroy(); resolve(false); });
            sock.connect(port, '127.0.0.1');
        });
        if (open)
            return true;
        await new Promise(r => setTimeout(r, 1000));
    }
    return false;
}
fastify.get('/api/openclaw/status', async () => {
    return {
        connected: OpenClawClient_1.OpenClawClient.getInstance().isConnected,
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
                await BrainManager_1.BrainManager.getInstance().start();
            }
            catch (e) {
                console.error('❌ Failed to start Embedded Brain:', e);
            }
            // Wait for the gateway port to actually accept TCP connections
            const portReady = await waitForPort(18789, 30000);
            if (portReady) {
                console.log(`🦞 Port 18789 open — connecting OpenClaw Client...`);
            }
            else {
                console.warn('⚠️ Port 18789 not open after 30s — connecting anyway (reconnect loop will retry)');
            }
            try {
                const client = OpenClawClient_1.OpenClawClient.getInstance(openClawUrl);
                client.connect();
            }
            catch (e) {
                console.warn('⚠️ OpenClaw Client failed to start:', e);
            }
        }, isDev ? 5000 : 2000);
        // Defer ALL background services to avoid blocking startup
        // These services call backend-team (port 4000) which may not be ready yet
        // and each call has 15-20s timeouts that block the event loop
        let snapshotInterval;
        let alertInterval;
        console.log('⏳ Deferring background services by 30s to allow fast startup...');
        setTimeout(() => {
            console.log('🔄 Starting background services (snapshot, alerts, news)...');
            snapshotInterval = PortfolioHistoryService_1.PortfolioHistoryService.startAutoSnapshot(15);
            alertInterval = AlertService_1.AlertService.startMonitoring(5);
            CryptoNewsService_1.CryptoNewsService.start();
        }, 30000); // 30s delay — UI is long visible by then
        // Sync existing wallets to backend-team for real-time tracking
        // Delay 45s to let backend-team finish starting + first refresh
        setTimeout(async () => {
            try {
                const allWallets = await exports.db.select().from(schema.wallets);
                console.log(`[WalletSync] Syncing ${allWallets.length} existing wallets for tracking...`);
                for (const w of allWallets) {
                    await BackendTeamClient_1.backendTeamClient.trackWallet(w.address, w.chainType, w.label || undefined)
                        .catch(() => { }); // Silent — will sync on next data refresh
                }
            }
            catch { }
        }, 45000);
        // Graceful shutdown handler
        const shutdown = async (signal) => {
            console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);
            if (snapshotInterval)
                clearInterval(snapshotInterval);
            if (alertInterval)
                clearInterval(alertInterval);
            CryptoNewsService_1.CryptoNewsService.stop();
            try {
                BrainManager_1.BrainManager.getInstance().stop();
            }
            catch { }
            try {
                await fastify.close();
            }
            catch { }
            try {
                sqlite.close();
            }
            catch { }
            console.log('[Server] Shutdown complete.');
            process.exit(0);
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
    catch (err) {
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
