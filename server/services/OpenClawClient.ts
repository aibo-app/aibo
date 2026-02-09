import * as WSModule from 'ws';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WebSocket = (WSModule as any).default || WSModule;
import type { WebSocket as WebSocketType } from 'ws';

import { db } from '../index';
import { wallets } from '../db/schema';
import { PortfolioService } from './PortfolioService';
import { and, eq } from 'drizzle-orm';

/**
 * OpenClawClient manages the real-time connection between the Aibō Desktop app (The Body)
 * and the OpenClaw Brain (The Agent). It facilitates tool execution and intent delegation.
 */
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

    private static instance: OpenClawClient;
    private pendingRequests = new Map<string, { resolve: (val: string) => void, reject: (err: Error) => void }>();

    private constructor(gatewayUrl: string = 'ws://localhost:3000') {
        this.url = gatewayUrl;
    }

    public static getInstance(gatewayUrl?: string): OpenClawClient {
        if (!OpenClawClient.instance) {
            OpenClawClient.instance = new OpenClawClient(gatewayUrl);
        }
        return OpenClawClient.instance;
    }

    public connect() {
        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws.close();
        }

        console.log(`[OpenClaw] Connecting to Gateway at ${this.url}...`);
        this.ws = new WebSocket(this.url) as WebSocketType;

        this.ws.on('open', () => {
            console.log('[OpenClaw] Connected to Gateway');
            this.isConnected = true;
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

        this.ws.on('close', () => {
            console.log('[OpenClaw] Disconnected. Reconnecting in 5s...');
            this.isConnected = false;
            this.stopMarketMonitoring();
            this.scheduleReconnect();
        });

        this.ws.on('error', (err: any) => {
            // Only show meaningful error context
            const code = err.code || 'UNKNOWN';
            console.error(`[OpenClaw] Connection error (${code}):`, err.message || 'Gateway not reachable');
            this.ws?.close();
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
                commands: ['portfolio.get_summary', 'portfolio.get_detailed_summary', 'portfolio.get_transactions', 'wallet.add']
            }
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async handleMessage(message: any) {
        if (message.type === 'node.call') {
            const { id, method, params } = message;
            try {
                let result;
                switch (method) {
                    case 'get_portfolio':
                        result = await this.getPortfolioSummary();
                        break;
                    case 'add_wallet':
                        result = await this.addWallet(params);
                        break;
                    case 'get_market_price':
                        result = await this.getMarketPrice(params);
                        break;
                    default:
                        throw new Error(`Method ${method} not supported`);
                }
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
    private actionListeners: ((action: any) => void)[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public setOnAction(callback: (action: any) => void) {
        this.onActionCallback = callback;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public addActionListener(callback: (action: any) => void) {
        this.actionListeners.push(callback);
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

            const text = message?.content?.[0]?.text || JSON.stringify(message);
            console.log(`[OpenClaw] Resolved chat request ${runId}`);

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

        this.actionListeners.forEach(listener => listener(actionPayload));
    }

    public async sendMessage(text: string): Promise<string> {
        if (!this.isConnected) {
            throw new Error('Not connected to OpenClaw Brain');
        }

        const requestId = Math.random().toString(36).substring(7);

        return new Promise((resolve, reject) => {
            // timeout 30s
            const timeout = setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    console.error(`[OpenClaw] Request ${requestId} timed out after 30s`);
                    reject(new Error('Brain timed out'));
                }
            }, 30000);

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
            let result;

            switch (command) {
                case 'portfolio.get_summary':
                    result = await this.getPortfolioSummary();
                    break;
                case 'portfolio.get_detailed_summary':
                    result = await this.getDetailedPortfolioSummary();
                    break;
                case 'portfolio.get_transactions':
                    result = await this.getRecentTransactions(args.wallets || []);
                    break;
                case 'wallet.add':
                    result = await this.addWallet(args);
                    break;
                case 'body.get_state':
                    result = this.bodyState;
                    break;
                case 'market.get_price':
                    result = await this.getMarketPrice(args);
                    break;
                default:
                    throw new Error(`Unknown command: ${command}`);
            }

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
            let result;
            switch (tool) {
                case 'portfolio.get_summary':
                    result = await this.getPortfolioSummary();
                    break;
                case 'portfolio.get_detailed_summary':
                    result = await this.getDetailedPortfolioSummary();
                    break;
                case 'portfolio.get_transactions':
                    result = await this.getRecentTransactions(args.wallets || []);
                    break;
                case 'body.get_state':
                    result = this.bodyState;
                    break;
                case 'wallet.add':
                    result = await this.addWallet(args);
                    break;
                case 'market.get_price':
                    result = await this.getMarketPrice(args);
                    break;
                default:
                    throw new Error(`Unknown tool: ${tool}`);
            }

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

    private async getPortfolioSummary() {
        // Fetch wallets from DB
        const storedWallets = await db.select().from(wallets);

        if (storedWallets.length === 0) {
            return "No wallets are currently being tracked. Please add a wallet in the Desktop Aibo UI.";
        }

        const mappedWallets = storedWallets.map(w => ({
            address: w.address,
            chainType: w.chainType as 'evm' | 'solana',
            label: w.label || undefined
        }));

        const portfolio = await PortfolioService.getAggregatedPortfolio(mappedWallets);

        // Format for Agent consumption (Text summary)
        const topAssets = portfolio.assets
            .sort((a: any, b: any) => b.value - a.value)
            .slice(0, 5)
            .map((a: any) => `${a.name} (${a.symbol}): $${a.value.toFixed(2)} (${a.change > 0 ? '+' : ''}${a.change.toFixed(1)}%)`)
            .join(', ');

        return `Total Portfolio Value: $${portfolio.totalValue.toFixed(2)}\n24h Change: ${portfolio.totalChange24h.toFixed(2)}%\nTop Assets: ${topAssets}`;
    }

    private async getMarketPrice(args: { symbol: string }) {
        if (!args.symbol) throw new Error('Symbol argument is required');

        const stats = await PortfolioService.getAssetStats(args.symbol);
        if (!stats) return `Could not find price data for ${args.symbol}`;

        return `${stats.name} (${stats.symbol}): $${stats.price} (24h: ${stats.change}%)`;
    }

    private async getDetailedPortfolioSummary() {
        const storedWallets = await db.select().from(wallets);
        if (storedWallets.length === 0) return { error: "No wallets tracked" };

        const mappedWallets = storedWallets.map(w => ({
            address: w.address,
            chainType: w.chainType as 'evm' | 'solana',
            label: w.label || undefined
        }));

        const portfolio = await PortfolioService.getAggregatedPortfolio(mappedWallets);
        return portfolio;
    }

    private async getRecentTransactions(walletsToFetch?: { address: string, chainType: 'evm' | 'solana', label?: string }[]) {
        let mappedWallets;
        if (walletsToFetch && walletsToFetch.length > 0) {
            mappedWallets = walletsToFetch;
        } else {
            const storedWallets = await db.select().from(wallets);
            if (storedWallets.length === 0) return { error: "No wallets tracked" };

            mappedWallets = storedWallets.map(w => ({
                address: w.address,
                chainType: w.chainType as 'evm' | 'solana',
                label: w.label || undefined
            }));
        }

        const txs = await PortfolioService.getRecentTransactions(mappedWallets);
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
