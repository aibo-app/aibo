import * as WSModule from 'ws';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WebSocket = (WSModule as any).default || WSModule;
import type { WebSocket as WebSocketType } from 'ws';

import { db } from '../index';
import { wallets } from '../db/schema';
import { PortfolioService } from './PortfolioService';
import { backendTeamClient } from './BackendTeamClient';
import { and, eq } from 'drizzle-orm';

/**
 * OpenClawClient manages the real-time connection between the Aibō Desktop app (The Body)
 * and the OpenClaw Brain (The Agent). It facilitates tool execution and intent delegation.
 */
/** Handler function for a node command */
type CommandHandler = (args: Record<string, any>) => Promise<any>;

export class OpenClawClient {
    private ws: WebSocketType | null = null;
    private url: string;
    private reconnectInterval: NodeJS.Timeout | null = null;
    public isConnected = false;
    private nodeId = `desktop-aibo-${Math.random().toString(36).substring(2, 9)}`;
    private marketInterval: NodeJS.Timeout | null = null;
    private lastSolPrice: number | null = null;
    private lastEthPrice: number | null = null;
    private bodyState = {
        activePage: 'dashboard',
        activeWallet: null as string | null,
        theme: 'light' as 'light' | 'dark'
    };

    /**
     * Formal Protocol for Body Side-Effects (Hardware Shell)
     */
    private readonly SUPPORTED_ACTIONS = ['set_status_color', 'vibrate_mascot', 'pulse_voice', 'navigate_to'];

    /** Dynamic command handler registry — new skills register handlers here */
    private commandHandlers = new Map<string, CommandHandler>();

    private static instance: OpenClawClient;
    private pendingRequests = new Map<string, { resolve: (val: string) => void, reject: (err: Error) => void }>();
    private reconnectAttempts = 0;

    private constructor(gatewayUrl: string = 'ws://127.0.0.1:18789') {
        this.url = gatewayUrl;
        this.registerBuiltinCommands();
    }

    /**
     * Register all built-in command handlers.
     * New skills can add handlers via registerCommand() at startup.
     */
    private registerBuiltinCommands(): void {
        this.registerCommand('portfolio.get_summary', () => this.getPortfolioSummary());
        this.registerCommand('portfolio.get_detailed_summary', () => this.getDetailedPortfolioSummary());
        this.registerCommand('portfolio.get_transactions', (args) => this.getRecentTransactions(args.wallets || []));
        this.registerCommand('wallet.add', (args) => this.addWallet(args as { address: string; chainType: string; label?: string }));
        this.registerCommand('body.get_state', () => Promise.resolve(this.bodyState));
        this.registerCommand('market.get_price', (args) => this.getMarketPrice(args as { symbol: string }));
        this.registerCommand('discovery.get_trending', () => this.getTrendingAlpha());
        this.registerCommand('discovery.get_clanker', () => this.getClankerAlpha());
    }

    /** Register a command handler. Can be called by skill modules at startup. */
    public registerCommand(name: string, handler: CommandHandler): void {
        this.commandHandlers.set(name, handler);
    }

    /** Get all registered command names (used for handshake + config). */
    public getRegisteredCommands(): string[] {
        return Array.from(this.commandHandlers.keys());
    }

    public static getInstance(gatewayUrl?: string): OpenClawClient {
        if (!OpenClawClient.instance) {
            OpenClawClient.instance = new OpenClawClient(gatewayUrl);
        } else if (gatewayUrl && OpenClawClient.instance.url !== gatewayUrl) {
            // Startup code may call this after early singleton creation (e.g. from WS handler)
            OpenClawClient.instance.url = gatewayUrl;
        }
        return OpenClawClient.instance;
    }

    public connect() {
        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws.close();
        }

        this.ws = new WebSocket(this.url) as WebSocketType;

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
        this.ws.on('message', (data: any) => {
            try {
                const message = JSON.parse(data.toString());
                // Silenced verbose logging: console.log('[OpenClaw] INCOMING:', JSON.stringify(message, null, 2));
                this.handleMessage(message);
            } catch (err) {
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

        this.ws.on('error', (error: any) => {
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

    private scheduleReconnect() {
        if (!this.reconnectInterval) {
            this.reconnectInterval = setTimeout(() => {
                this.reconnectInterval = null;
                this.connect();
            }, 5000);
        }
    }

    private startHandshake() {
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
    private async handleMessage(message: any) {
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
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                this.send({ type: 'res', id, ok: false, error: { message: error.message } });
            }
        } else if (message.type === 'agent_action') {
            this.executeAction(message.action, message.data);
        } else if (message.type === 'res') {
            this.handleResponse(message);
        } else if (message.type === 'event') {
            if (message.event === 'node.invoke.request') {
                await this.handleInvokeRequest(message.payload);
            } else if (message.event === 'chat') {
                this.handleChatEvent(message.payload);
            }
        } else {
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
    private handleResponse(message: any) {
        const { id, ok, payload, error } = message;
        if (this.pendingRequests.has(id)) {
            if (ok) {
                // Extract text from various potential payload shapes
                let text = '';
                if (typeof payload === 'string') text = payload;
                else if (typeof payload === 'object') {
                    if (payload.message?.content) text = payload.message.content;
                    else if (payload.content) text = payload.content;
                    else if (payload.text) text = payload.text;
                    else text = JSON.stringify(payload);
                }

                // FILTER: Ignore "status started" messages to prevent TTS reading them
                // and keep the request pending for the real response.
                const isStatusMessage =
                    (typeof payload === 'object' && payload.status === 'started') ||
                    text.includes('"status":"started"') ||
                    text.includes('status started') ||
                    text.includes('listening on ws');

                if (isStatusMessage) {
                    console.log(`[OpenClaw] Filtering internal status message: ${text.substring(0, 100)}...`);
                    return;
                }

                const { resolve } = this.pendingRequests.get(id)!;
                this.pendingRequests.delete(id);

                this.detectAndDispatchActions(text);
                resolve(text);
            } else {
                const { reject } = this.pendingRequests.get(id)!;
                this.pendingRequests.delete(id);
                reject(new Error(error?.message || 'Unknown error from Brain'));
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private onActionCallback: ((action: any) => void) | null = null;
    private actionListeners: Set<(action: any) => void> = new Set();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public setOnAction(callback: (action: any) => void) {
        this.onActionCallback = callback;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public addActionListener(callback: (action: any) => void) {
        this.actionListeners.add(callback);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public removeActionListener(callback: (action: any) => void) {
        this.actionListeners.delete(callback);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private handleResult(message: any) {
        const { requestId, status, result, error } = message.payload;
        if (this.pendingRequests.has(requestId)) {
            const { resolve, reject } = this.pendingRequests.get(requestId)!;
            this.pendingRequests.delete(requestId);
            if (status === 'success') {
                // Professional Protocol: Check for structured action blocks
                this.detectAndDispatchActions(result);
                resolve(result);
            } else {
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
    private handleChatEvent(payload: any) {
        const { runId, state, message } = payload;

        // Only resolve on final state to ensure we have the full message
        if (state === 'final' && this.pendingRequests.has(runId)) {
            const { resolve } = this.pendingRequests.get(runId)!;
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
    private detectAndDispatchActions(result: any) {
        if (typeof result !== 'string') return;

        const jsonMatch = result.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
            try {
                const data = JSON.parse(jsonMatch[1]);
                if (data.type === 'agent_action' && this.SUPPORTED_ACTIONS.includes(data.action)) {
                    this.executeAction(data.action, data.data);
                }
            } catch {
                // Not a valid action JSON, skip
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private executeAction(actionName: string, data: any) {
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
            } catch (error) {
                console.error('[OpenClaw] Action listener error:', error);
            }
        });
    }

    public async sendMessage(text: string): Promise<string> {
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
    private async handleInvokeRequest(payload: any) {
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
        } catch (error) {
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
    private async handleInvoke(message: any) {
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
        } catch (error: any) {
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
    private send(message: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Silenced verbose logging: console.log(`[OpenClaw] OUTGOING: ${JSON.stringify(message, null, 2)}`);
            this.ws.send(JSON.stringify(message));
        }
    }

    public updateBodyState(state: Partial<typeof this.bodyState>) {
        this.bodyState = { ...this.bodyState, ...state };
        // Reduced level from log to debug equivalent (silenced for clean terminal)
        // console.log('📱 [OpenClaw] Body State Updated:', this.bodyState);
    }

    // --- Tool Implementations ---

    /** Race a promise against a timeout — brain commands should not block for 10s+ */
    private raceTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
        return Promise.race([
            promise,
            new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))
        ]);
    }

    private async getWalletList() {
        const storedWallets = await db.select().from(wallets);
        return storedWallets.map(w => ({
            address: w.address,
            chainType: w.chainType as 'evm' | 'solana',
            label: w.label || undefined
        }));
    }

    private async getPortfolioSummary() {
        const mappedWallets = await this.getWalletList();
        if (mappedWallets.length === 0) {
            return "No wallets are currently being tracked. Please add a wallet in the Desktop Aibo UI.";
        }

        const portfolio = await this.raceTimeout(
            PortfolioService.getAggregatedPortfolio(mappedWallets),
            5000,
            { assets: [], totalValue: 0, totalChange24h: 0 }
        );

        if (!portfolio.assets || portfolio.assets.length === 0) {
            return "Portfolio data is still loading. Try again in a moment.";
        }

        const topAssets = portfolio.assets
            .sort((a: any, b: any) => b.value - a.value)
            .slice(0, 5)
            .map((a: any) => `${a.name} (${a.symbol}): $${a.value.toFixed(2)} (${a.change > 0 ? '+' : ''}${a.change.toFixed(1)}%)`)
            .join(', ');

        return `Total Portfolio Value: $${portfolio.totalValue.toFixed(2)}\n24h Change: ${portfolio.totalChange24h.toFixed(2)}%\nTop Assets: ${topAssets}`;
    }

    private async getMarketPrice(args: { symbol: string }) {
        if (!args.symbol) throw new Error('Symbol argument is required');

        const stats = await this.raceTimeout(
            PortfolioService.getAssetStats(args.symbol),
            5000,
            null
        );
        if (!stats) return `Could not find price data for ${args.symbol}`;

        return `${args.symbol} (${stats.symbol}): $${stats.price} (24h: ${stats.change24h}%)`;
    }

    private async getDetailedPortfolioSummary() {
        const mappedWallets = await this.getWalletList();
        if (mappedWallets.length === 0) return { error: "No wallets tracked" };

        const portfolio = await this.raceTimeout(
            PortfolioService.getAggregatedPortfolio(mappedWallets),
            5000,
            { assets: [], totalValue: 0, totalChange24h: 0 }
        );

        if (!portfolio.assets || portfolio.assets.length === 0) {
            return { error: "Portfolio data is still loading. Try again in a moment." };
        }
        return portfolio;
    }

    private async getRecentTransactions(walletsToFetch?: { address: string, chainType: 'evm' | 'solana', label?: string }[]) {
        let mappedWallets;
        if (walletsToFetch && walletsToFetch.length > 0) {
            mappedWallets = walletsToFetch;
        } else {
            mappedWallets = await this.getWalletList();
            if (mappedWallets.length === 0) return { error: "No wallets tracked" };
        }

        const txs = await this.raceTimeout(
            PortfolioService.getRecentTransactions(mappedWallets),
            5000,
            [] as any[]
        );
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

    private async addWallet(args: { address: string, chainType: string, label?: string }) {
        if (!args.address || !args.chainType) {
            throw new Error('Address and chainType are required');
        }

        const type = args.chainType.toLowerCase() === 'solana' ? 'solana' : 'evm';

        // Check for duplicates
        const existing = await db.select()
            .from(wallets)
            .where(and(
                eq(wallets.address, args.address),
                eq(wallets.chainType, type)
            ));

        if (existing.length > 0) {
            return `Wallet ${args.address} on ${type} is already being tracked.`;
        }

        await db.insert(wallets).values({
            address: args.address,
            chainType: type,
            label: args.label || `${type.toUpperCase()} Wallet`,
            addedAt: Date.now()
        });

        return `Successfully added ${type.toUpperCase()} wallet: ${args.address}${args.label ? ` (${args.label})` : ''}. Tracking will begin shortly.`;
    }

    private async getTrendingAlpha() {
        const trending = await backendTeamClient.getTrendingNewTokens(5);
        if (trending.length === 0) return "No trending tokens discovered on Base at the moment.";

        return trending.map(t =>
            `🔥 ${t.symbol} (${t.name}): $${t.price < 0.01 ? t.price.toFixed(6) : t.price.toFixed(2)} | Liq: $${(t.liquidity / 1000).toFixed(1)}k | 24h: ${t.priceChange24h.toFixed(1)}% | Score: ${t.trendingScore?.toFixed(0)}`
        ).join('\n');
    }

    private async getClankerAlpha() {
        const clanker = await backendTeamClient.getClankerTokens();
        if (clanker.length === 0) return "No new AI tokens from Clanker detected recently.";

        return clanker.slice(0, 5).map(t =>
            `🤖 ${t.symbol}: $${t.price < 0.01 ? t.price.toFixed(6) : t.price.toFixed(2)} | 24h: ${t.priceChange24h.toFixed(1)}% | Via: ${t.launchpadDetected}`
        ).join('\n');
    }

    // --- Monitoring Logic ---

    private startMarketMonitoring() {
        if (this.marketInterval) return;
        console.log('📈 [OpenClaw] Starting Scoped Market Monitor...');
        this.marketInterval = setInterval(() => this.checkMarketVolatility(), 60000);
        this.checkMarketVolatility();
    }

    private stopMarketMonitoring() {
        if (this.marketInterval) {
            clearInterval(this.marketInterval);
            this.marketInterval = null;
        }
    }

    private async checkMarketVolatility() {
        try {
            // Monitor both SOL and ETH (on Base)
            const assetsToWatch = ['SOL', 'ETH'];

            for (const symbol of assetsToWatch) {
                const stats = await PortfolioService.getAssetStats(symbol);
                if (!stats) continue;

                const currentPrice = stats.price as number;
                const isSol = symbol === 'SOL';
                const lastPrice = isSol ? this.lastSolPrice : this.lastEthPrice;

                if (lastPrice === null || lastPrice === undefined) {
                    if (isSol) this.lastSolPrice = currentPrice;
                    else this.lastEthPrice = currentPrice;
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

                if (isSol) this.lastSolPrice = currentPrice;
                else this.lastEthPrice = currentPrice;
            }
        } catch (err) {
            console.error('[OpenClaw] Market monitor error:', err);
        }
    }
}
