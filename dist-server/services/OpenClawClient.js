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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenClawClient = void 0;
const WSModule = __importStar(require("ws"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WebSocket = WSModule.default || WSModule;
const index_1 = require("../index");
const schema_1 = require("../db/schema");
const PortfolioService_1 = require("./PortfolioService");
const BackendTeamClient_1 = require("./BackendTeamClient");
const drizzle_orm_1 = require("drizzle-orm");
class OpenClawClient {
    ws = null;
    url;
    reconnectInterval = null;
    isConnected = false;
    nodeId = `desktop-aibo-${Math.random().toString(36).substring(2, 9)}`;
    marketInterval = null;
    lastSolPrice = null;
    lastEthPrice = null;
    bodyState = {
        activePage: 'dashboard',
        activeWallet: null,
        theme: 'light'
    };
    /**
     * Formal Protocol for Body Side-Effects (Hardware Shell)
     */
    SUPPORTED_ACTIONS = ['set_status_color', 'vibrate_mascot', 'pulse_voice', 'navigate_to'];
    /** Dynamic command handler registry — new skills register handlers here */
    commandHandlers = new Map();
    static instance;
    pendingRequests = new Map();
    reconnectAttempts = 0;
    constructor(gatewayUrl = 'ws://127.0.0.1:18789') {
        this.url = gatewayUrl;
        this.registerBuiltinCommands();
    }
    /**
     * Register all built-in command handlers.
     * New skills can add handlers via registerCommand() at startup.
     */
    registerBuiltinCommands() {
        this.registerCommand('portfolio.get_summary', () => this.getPortfolioSummary());
        this.registerCommand('portfolio.get_detailed_summary', () => this.getDetailedPortfolioSummary());
        this.registerCommand('portfolio.get_transactions', (args) => this.getRecentTransactions(args.wallets || []));
        this.registerCommand('wallet.add', (args) => this.addWallet(args));
        this.registerCommand('body.get_state', () => Promise.resolve(this.bodyState));
        this.registerCommand('market.get_price', (args) => this.getMarketPrice(args));
        this.registerCommand('discovery.get_trending', () => this.getTrendingAlpha());
        this.registerCommand('discovery.get_clanker', () => this.getClankerAlpha());
    }
    /** Register a command handler. Can be called by skill modules at startup. */
    registerCommand(name, handler) {
        this.commandHandlers.set(name, handler);
    }
    /** Get all registered command names (used for handshake + config). */
    getRegisteredCommands() {
        return Array.from(this.commandHandlers.keys());
    }
    static getInstance(gatewayUrl) {
        if (!OpenClawClient.instance) {
            OpenClawClient.instance = new OpenClawClient(gatewayUrl);
        }
        else if (gatewayUrl && OpenClawClient.instance.url !== gatewayUrl) {
            // Startup code may call this after early singleton creation (e.g. from WS handler)
            OpenClawClient.instance.url = gatewayUrl;
        }
        return OpenClawClient.instance;
    }
    connect() {
        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws.close();
        }
        this.ws = new WebSocket(this.url);
        this.ws.on('open', () => {
            if (this.reconnectAttempts > 0) {
                console.log(`🟢 [OpenClaw] Connected after ${this.reconnectAttempts} attempt(s)`);
            }
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.startHandshake();
            this.startMarketMonitoring();
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                // Silenced verbose logging: console.log('[OpenClaw] INCOMING:', JSON.stringify(message, null, 2));
                this.handleMessage(message);
            }
            catch (err) {
                console.error('[OpenClaw] Failed to parse message:', err);
                console.log('[OpenClaw] RAW DATA:', data.toString());
            }
        });
        this.ws.on('close', (code, reason) => {
            const wasConnected = this.isConnected;
            this.isConnected = false;
            this.stopMarketMonitoring();
            // Only log on actual disconnects, not during reconnection attempts
            if (wasConnected) {
                const reasonStr = reason ? ` reason: ${reason.toString()}` : '';
                console.log(`[OpenClaw] Disconnected (code: ${code}${reasonStr}). Reconnecting...`);
            }
            this.reconnectAttempts++;
            this.scheduleReconnect();
        });
        this.ws.on('error', (error) => {
            // Only log first error, suppress during reconnection loop
            if (this.reconnectAttempts === 0) {
                const detail = error.message || error.code || String(error);
                console.warn(`[OpenClaw] Connection failed: ${detail}`);
            }
            if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
                this.ws?.close();
            }
        });
    }
    scheduleReconnect() {
        if (!this.reconnectInterval) {
            this.reconnectInterval = setTimeout(() => {
                this.reconnectInterval = null;
                this.connect();
            }, 5000);
        }
    }
    startHandshake() {
        const commands = this.getRegisteredCommands();
        console.log(`[OpenClaw] Handshake declaring ${commands.length} commands: ${commands.join(', ')}`);
        this.send({
            type: 'req',
            id: `handshake-${Date.now()}`,
            method: 'connect',
            params: {
                client: {
                    id: 'node-host',
                    displayName: 'Desktop Aibo Assistant',
                    version: '1.2.0',
                    platform: 'macos',
                    mode: 'node'
                },
                auth: {
                    token: 'aibo'
                },
                role: 'node',
                minProtocol: 3,
                maxProtocol: 3,
                scopes: ['portfolio:read', 'wallet:manage', 'market:read', 'operator.admin'],
                commands
            }
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async handleMessage(message) {
        if (message.type === 'node.call') {
            const { id, method, params } = message;
            try {
                // Try registry first, fall back to legacy method names
                const handler = this.commandHandlers.get(method);
                if (!handler) {
                    throw new Error(`Method ${method} not supported. Registered: ${this.getRegisteredCommands().join(', ')}`);
                }
                const result = await handler(params || {});
                this.send({ type: 'res', id, ok: true, payload: result });
            }
            catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                this.send({ type: 'res', id, ok: false, error: { message: error.message } });
            }
        }
        else if (message.type === 'agent_action') {
            this.executeAction(message.action, message.data);
        }
        else if (message.type === 'res') {
            this.handleResponse(message);
        }
        else if (message.type === 'event') {
            if (message.event === 'node.invoke.request') {
                await this.handleInvokeRequest(message.payload);
            }
            else if (message.event === 'chat') {
                this.handleChatEvent(message.payload);
            }
        }
        else {
            switch (message.type) {
                case 'node.invoke': // Legacy support
                    await this.handleInvoke(message);
                    break;
                case 'system.ping':
                    this.send({ type: 'system.pong' });
                    break;
                case 'node.result':
                    this.handleResult(message);
                    break;
                default:
                    // console.log('[OpenClaw] Ignored message:', message.type);
                    break;
            }
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handleResponse(message) {
        const { id, ok, payload, error } = message;
        if (this.pendingRequests.has(id)) {
            if (ok) {
                // Extract text from various potential payload shapes
                let text = '';
                if (typeof payload === 'string')
                    text = payload;
                else if (typeof payload === 'object') {
                    if (payload.message?.content)
                        text = payload.message.content;
                    else if (payload.content)
                        text = payload.content;
                    else if (payload.text)
                        text = payload.text;
                    else
                        text = JSON.stringify(payload);
                }
                // FILTER: Ignore "status started" messages to prevent TTS reading them
                // and keep the request pending for the real response.
                const isStatusMessage = (typeof payload === 'object' && payload.status === 'started') ||
                    text.includes('"status":"started"') ||
                    text.includes('status started') ||
                    text.includes('listening on ws');
                if (isStatusMessage) {
                    console.log(`[OpenClaw] Filtering internal status message: ${text.substring(0, 100)}...`);
                    return;
                }
                const { resolve } = this.pendingRequests.get(id);
                this.pendingRequests.delete(id);
                this.detectAndDispatchActions(text);
                resolve(text);
            }
            else {
                const { reject } = this.pendingRequests.get(id);
                this.pendingRequests.delete(id);
                reject(new Error(error?.message || 'Unknown error from Brain'));
            }
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onActionCallback = null;
    actionListeners = new Set();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setOnAction(callback) {
        this.onActionCallback = callback;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addActionListener(callback) {
        this.actionListeners.add(callback);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    removeActionListener(callback) {
        this.actionListeners.delete(callback);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handleResult(message) {
        const { requestId, status, result, error } = message.payload;
        if (this.pendingRequests.has(requestId)) {
            const { resolve, reject } = this.pendingRequests.get(requestId);
            this.pendingRequests.delete(requestId);
            if (status === 'success') {
                // Professional Protocol: Check for structured action blocks
                this.detectAndDispatchActions(result);
                resolve(result);
            }
            else {
                reject(new Error(error || 'Unknown error from Brain'));
            }
        }
    }
    /**
     * Scans results for serialized AgentAction blocks.
     * In a professional bridge, the Brain should ideally use a separate message type,
     * but this ensures backward compatibility with text-based reasoning models.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handleChatEvent(payload) {
        const { runId, state, message } = payload;
        // Only resolve on final state to ensure we have the full message
        if (state === 'final' && this.pendingRequests.has(runId)) {
            const { resolve } = this.pendingRequests.get(runId);
            this.pendingRequests.delete(runId);
            console.log(`[OpenClaw] 🔍 Full chat event payload:`, JSON.stringify(payload, null, 2));
            if (!message) {
                console.error(`[OpenClaw] ❌ Message is undefined in final state for runId ${runId}`);
                resolve("Sorry, I didn't receive a response from my brain.");
                return;
            }
            const text = message?.content?.[0]?.text || JSON.stringify(message) || '';
            console.log(`[OpenClaw] Resolved chat request ${runId}`);
            console.log(`[OpenClaw] 📝 Extracted text (${text.length} chars):`, text.substring(0, 200));
            this.detectAndDispatchActions(text);
            resolve(text);
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    detectAndDispatchActions(result) {
        if (typeof result !== 'string')
            return;
        const jsonMatch = result.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
            try {
                const data = JSON.parse(jsonMatch[1]);
                if (data.type === 'agent_action' && this.SUPPORTED_ACTIONS.includes(data.action)) {
                    this.executeAction(data.action, data.data);
                }
            }
            catch {
                // Not a valid action JSON, skip
            }
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    executeAction(actionName, data) {
        if (!this.SUPPORTED_ACTIONS.includes(actionName)) {
            console.warn(`[OpenClaw] Unsupported action: ${actionName}`);
            return;
        }
        console.log(`📡 [OpenClaw] Executing Shell Action: ${actionName}`, data);
        const actionPayload = { type: 'agent_action', action: actionName, data };
        if (this.onActionCallback) {
            this.onActionCallback(actionPayload);
        }
        this.actionListeners.forEach(listener => {
            try {
                listener(actionPayload);
            }
            catch (error) {
                console.error('[OpenClaw] Action listener error:', error);
            }
        });
    }
    async sendMessage(text) {
        if (!this.isConnected) {
            throw new Error('Not connected to OpenClaw Brain');
        }
        const requestId = Math.random().toString(36).substring(7);
        return new Promise((resolve, reject) => {
            // timeout 90s — tool calls (portfolio fetch) can take 15s+ per round-trip
            const timeout = setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    console.error(`[OpenClaw] Request ${requestId} timed out after 90s`);
                    reject(new Error('Brain timed out'));
                }
            }, 90000);
            this.pendingRequests.set(requestId, {
                resolve: (res) => { clearTimeout(timeout); resolve(res); },
                reject: (err) => { clearTimeout(timeout); reject(err); }
            });
            this.send({
                type: 'req',
                id: requestId,
                method: 'chat.send',
                params: {
                    message: text,
                    sessionKey: 'agent:main:main',
                    idempotencyKey: requestId
                }
            });
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async handleInvokeRequest(payload) {
        const { id, command, paramsJSON } = payload;
        console.log(`[OpenClaw] Invoked command: ${command}`, paramsJSON);
        try {
            const args = paramsJSON ? JSON.parse(paramsJSON) : {};
            const handler = this.commandHandlers.get(command);
            if (!handler) {
                throw new Error(`Unknown command: ${command}. Registered: ${this.getRegisteredCommands().join(', ')}`);
            }
            const result = await handler(args);
            this.send({
                type: 'req',
                id: `res-${id}`,
                method: 'node.invoke.result',
                params: {
                    id,
                    nodeId: 'node-host',
                    ok: true,
                    payload: result
                }
            });
        }
        catch (error) {
            console.error(`[OpenClaw] Tool execution failed: ${command}`, error);
            this.send({
                type: 'req',
                id: `res-${id}`,
                method: 'node.invoke.result',
                params: {
                    id,
                    nodeId: 'node-host',
                    ok: false,
                    error: {
                        message: error instanceof Error ? error.message : String(error)
                    }
                }
            });
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async handleInvoke(message) {
        const { requestId, tool, args } = message.payload;
        console.log(`[OpenClaw] Invoked tool (legacy): ${tool}`, args);
        try {
            const handler = this.commandHandlers.get(tool);
            if (!handler) {
                throw new Error(`Unknown tool: ${tool}. Registered: ${this.getRegisteredCommands().join(', ')}`);
            }
            const result = await handler(args || {});
            this.send({
                type: 'node.result',
                payload: {
                    requestId,
                    status: 'success',
                    result
                }
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }
        catch (error) {
            console.error(`[OpenClaw] Tool execution failed:`, error);
            this.send({
                type: 'node.result',
                payload: {
                    requestId,
                    status: 'error',
                    error: error.message
                }
            });
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Silenced verbose logging: console.log(`[OpenClaw] OUTGOING: ${JSON.stringify(message, null, 2)}`);
            this.ws.send(JSON.stringify(message));
        }
    }
    updateBodyState(state) {
        this.bodyState = { ...this.bodyState, ...state };
        // Reduced level from log to debug equivalent (silenced for clean terminal)
        // console.log('📱 [OpenClaw] Body State Updated:', this.bodyState);
    }
    // --- Tool Implementations ---
    async getPortfolioSummary() {
        // Fetch wallets from DB
        const storedWallets = await index_1.db.select().from(schema_1.wallets);
        if (storedWallets.length === 0) {
            return "No wallets are currently being tracked. Please add a wallet in the Desktop Aibo UI.";
        }
        const mappedWallets = storedWallets.map(w => ({
            address: w.address,
            chainType: w.chainType,
            label: w.label || undefined
        }));
        const portfolio = await PortfolioService_1.PortfolioService.getAggregatedPortfolio(mappedWallets);
        // Format for Agent consumption (Text summary)
        const topAssets = portfolio.assets
            .sort((a, b) => b.value - a.value)
            .slice(0, 5)
            .map((a) => `${a.name} (${a.symbol}): $${a.value.toFixed(2)} (${a.change > 0 ? '+' : ''}${a.change.toFixed(1)}%)`)
            .join(', ');
        return `Total Portfolio Value: $${portfolio.totalValue.toFixed(2)}\n24h Change: ${portfolio.totalChange24h.toFixed(2)}%\nTop Assets: ${topAssets}`;
    }
    async getMarketPrice(args) {
        if (!args.symbol)
            throw new Error('Symbol argument is required');
        const stats = await PortfolioService_1.PortfolioService.getAssetStats(args.symbol);
        if (!stats)
            return `Could not find price data for ${args.symbol}`;
        return `${args.symbol} (${stats.symbol}): $${stats.price} (24h: ${stats.change24h}%)`;
    }
    async getDetailedPortfolioSummary() {
        const storedWallets = await index_1.db.select().from(schema_1.wallets);
        if (storedWallets.length === 0)
            return { error: "No wallets tracked" };
        const mappedWallets = storedWallets.map(w => ({
            address: w.address,
            chainType: w.chainType,
            label: w.label || undefined
        }));
        const portfolio = await PortfolioService_1.PortfolioService.getAggregatedPortfolio(mappedWallets);
        return portfolio;
    }
    async getRecentTransactions(walletsToFetch) {
        let mappedWallets;
        if (walletsToFetch && walletsToFetch.length > 0) {
            mappedWallets = walletsToFetch;
        }
        else {
            const storedWallets = await index_1.db.select().from(schema_1.wallets);
            if (storedWallets.length === 0)
                return { error: "No wallets tracked" };
            mappedWallets = storedWallets.map(w => ({
                address: w.address,
                chainType: w.chainType,
                label: w.label || undefined
            }));
        }
        const txs = await PortfolioService_1.PortfolioService.getRecentTransactions(mappedWallets);
        // Map to simpler format for Agent to avoid token overflow
        return txs.slice(0, 10).map(t => ({
            type: t.type,
            amount: t.amount,
            symbol: t.symbol,
            time: t.time,
            chain: t.chain,
            status: t.status,
            details: t.swapDetails ? t.swapDetails.label : undefined
        }));
    }
    async addWallet(args) {
        if (!args.address || !args.chainType) {
            throw new Error('Address and chainType are required');
        }
        const type = args.chainType.toLowerCase() === 'solana' ? 'solana' : 'evm';
        // Check for duplicates
        const existing = await index_1.db.select()
            .from(schema_1.wallets)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.wallets.address, args.address), (0, drizzle_orm_1.eq)(schema_1.wallets.chainType, type)));
        if (existing.length > 0) {
            return `Wallet ${args.address} on ${type} is already being tracked.`;
        }
        await index_1.db.insert(schema_1.wallets).values({
            address: args.address,
            chainType: type,
            label: args.label || `${type.toUpperCase()} Wallet`,
            addedAt: Date.now()
        });
        return `Successfully added ${type.toUpperCase()} wallet: ${args.address}${args.label ? ` (${args.label})` : ''}. Tracking will begin shortly.`;
    }
    async getTrendingAlpha() {
        const trending = await BackendTeamClient_1.backendTeamClient.getTrendingNewTokens(5);
        if (trending.length === 0)
            return "No trending tokens discovered on Base at the moment.";
        return trending.map(t => `🔥 ${t.symbol} (${t.name}): $${t.price < 0.01 ? t.price.toFixed(6) : t.price.toFixed(2)} | Liq: $${(t.liquidity / 1000).toFixed(1)}k | 24h: ${t.priceChange24h.toFixed(1)}% | Score: ${t.trendingScore?.toFixed(0)}`).join('\n');
    }
    async getClankerAlpha() {
        const clanker = await BackendTeamClient_1.backendTeamClient.getClankerTokens();
        if (clanker.length === 0)
            return "No new AI tokens from Clanker detected recently.";
        return clanker.slice(0, 5).map(t => `🤖 ${t.symbol}: $${t.price < 0.01 ? t.price.toFixed(6) : t.price.toFixed(2)} | 24h: ${t.priceChange24h.toFixed(1)}% | Via: ${t.launchpadDetected}`).join('\n');
    }
    // --- Monitoring Logic ---
    startMarketMonitoring() {
        if (this.marketInterval)
            return;
        console.log('📈 [OpenClaw] Starting Scoped Market Monitor...');
        this.marketInterval = setInterval(() => this.checkMarketVolatility(), 60000);
        this.checkMarketVolatility();
    }
    stopMarketMonitoring() {
        if (this.marketInterval) {
            clearInterval(this.marketInterval);
            this.marketInterval = null;
        }
    }
    async checkMarketVolatility() {
        try {
            // Monitor both SOL and ETH (on Base)
            const assetsToWatch = ['SOL', 'ETH'];
            for (const symbol of assetsToWatch) {
                const stats = await PortfolioService_1.PortfolioService.getAssetStats(symbol);
                if (!stats)
                    continue;
                const currentPrice = stats.price;
                const isSol = symbol === 'SOL';
                const lastPrice = isSol ? this.lastSolPrice : this.lastEthPrice;
                if (lastPrice === null || lastPrice === undefined) {
                    if (isSol)
                        this.lastSolPrice = currentPrice;
                    else
                        this.lastEthPrice = currentPrice;
                    continue;
                }
                const delta = ((currentPrice - lastPrice) / lastPrice) * 100;
                // Threshold: 1.0% move triggers a reaction
                if (Math.abs(delta) >= 1.0) {
                    console.log(`🧨 [OpenClaw] Volatility Detected: ${symbol} ${delta > 0 ? 'UP' : 'DOWN'} ${Math.abs(delta).toFixed(2)}%`);
                    if (this.onActionCallback) {
                        this.onActionCallback({
                            type: 'agent_action',
                            action: 'set_status_color',
                            data: {
                                color: delta < 0 ? '#ff4d4d' : '#4dff88',
                                duration: 15000,
                                message: `${symbol} moved ${delta.toFixed(2)}%`
                            }
                        });
                        // Add a vibration effect for larger moves (> 2%)
                        if (Math.abs(delta) >= 2.0) {
                            this.onActionCallback({
                                type: 'agent_action',
                                action: 'vibrate_mascot',
                                data: { intensity: 'high' }
                            });
                        }
                    }
                }
                if (isSol)
                    this.lastSolPrice = currentPrice;
                else
                    this.lastEthPrice = currentPrice;
            }
        }
        catch (err) {
            console.error('[OpenClaw] Market monitor error:', err);
        }
    }
}
exports.OpenClawClient = OpenClawClient;
