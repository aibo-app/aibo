"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backendTeamClient = exports.BackendTeamClient = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * Client for communicating with the Backend Team secure proxy
 * This service handles all blockchain data aggregation and keeps API keys secure
 */
class BackendTeamClient {
    static instance;
    client;
    baseURL;
    teamToken;
    startupTime = Date.now();
    static STARTUP_GRACE_MS = 45_000; // 45s — suppress errors while backend boots
    /** During startup grace period, use warn instead of error to keep console clean */
    logError(msg, detail) {
        const isStartup = Date.now() - this.startupTime < BackendTeamClient.STARTUP_GRACE_MS;
        if (isStartup) {
            // Single quiet line during startup
            console.warn(`[BackendTeam] ${msg} (backend still starting)`);
        }
        else {
            console.error(`[BackendTeam] ${msg}${detail ? ': ' + detail : ''}`);
        }
    }
    constructor() {
        this.baseURL = process.env.BACKEND_TEAM_URL || process.env.TEAM_BACKEND_URL || 'http://localhost:4000';
        this.teamToken = process.env.BACKEND_TEAM_TOKEN || process.env.TEAM_TOKEN || '';
        if (!this.teamToken) {
            console.warn('[BackendTeam] WARNING: BACKEND_TEAM_TOKEN not set. Set it in .env for secure communication.');
        }
        this.client = axios_1.default.create({
            baseURL: this.baseURL,
            timeout: 8000, // 8s default — fail fast, don't block UI
            headers: {
                'x-team-token': this.teamToken,
                'Content-Type': 'application/json'
            }
        });
        console.log(`[BackendTeam] Client initialized: ${this.baseURL}`);
    }
    static getInstance() {
        if (!BackendTeamClient.instance) {
            BackendTeamClient.instance = new BackendTeamClient();
        }
        return BackendTeamClient.instance;
    }
    /**
     * Get aggregated portfolio data for multiple wallets
     */
    async getPortfolio(wallets) {
        try {
            const response = await this.client.post('/v1/portfolio', { wallets }, { timeout: 10000 });
            return response.data;
        }
        catch (error) {
            this.logError('Portfolio fetch failed', error.message);
            throw new Error(`Backend Team API Error: ${error.message}`);
        }
    }
    /**
     * Get recent transactions for wallets
     */
    async getTransactions(wallets) {
        try {
            const response = await this.client.post('/v1/transactions', { wallets }, { timeout: 10000 });
            return response.data;
        }
        catch (error) {
            this.logError('Transaction fetch failed', error.message);
            return [];
        }
    }
    /**
     * Get price and metadata for a token by symbol or address
     */
    async getTokenPrice(symbolOrAddress) {
        try {
            const response = await this.client.get(`/v1/price/${symbolOrAddress}`, { timeout: 8000 });
            return response.data;
        }
        catch (error) {
            this.logError(`Price fetch failed for ${symbolOrAddress}`, error.message);
            return null;
        }
    }
    /**
     * Get top market tokens
     */
    async getTopMarkets(limit = 20) {
        try {
            const response = await this.client.get('/v1/markets/top', { params: { limit }, timeout: 8000 });
            return response.data;
        }
        catch (error) {
            this.logError('Top markets fetch failed', error.message);
            return [];
        }
    }
    /**
     * Get global market data (Market Cap, Volume, Dominance, etc.)
     */
    async getMarketGlobal() {
        try {
            const response = await this.client.get('/v1/market/global', { timeout: 8000 });
            return response.data;
        }
        catch (error) {
            this.logError('Global market fetch failed', error.message);
            return null;
        }
    }
    /**
     * Get deep metadata for a specific token
     */
    async getTokenMetadata(chain, address) {
        try {
            const response = await this.client.get(`/v1/metadata/${chain}/${address}`, { timeout: 10000 });
            return response.data;
        }
        catch (error) {
            this.logError(`Metadata fetch failed for ${chain}:${address}`, error.message);
            return null;
        }
    }
    /**
     * Proxy AI chat query to DeepSeek
     */
    async chatQuery(transcript) {
        try {
            const response = await this.client.post('/v1/chat/query', { transcript }, { timeout: 30000 });
            return response.data.response;
        }
        catch (error) {
            this.logError('Chat query failed', error.message);
            throw new Error(`Chat API Error: ${error.message}`);
        }
    }
    /**
     * Transcribe audio via Deepgram (proxied through backend-team)
     */
    async transcribe(audioBuffer) {
        try {
            const response = await this.client.post('/v1/transcribe', audioBuffer, {
                headers: {
                    'Content-Type': 'audio/webm',
                    'x-team-token': this.teamToken,
                },
                timeout: 15000,
                maxBodyLength: 10 * 1024 * 1024,
            });
            return response.data;
        }
        catch (error) {
            this.logError('Transcription failed', error.message);
            throw new Error(`Transcription API Error: ${error.message}`);
        }
    }
    /**
     * Get AI profiling for a wallet address
     */
    async getWalletProfile(address) {
        try {
            const response = await this.client.get(`/v1/profile/${address}`);
            return response.data;
        }
        catch (error) {
            this.logError(`Wallet profiling failed for ${address}`, error.message);
            return null;
        }
    }
    /**
     * Get trending new tokens from Base
     */
    async getTrendingNewTokens(limit = 20) {
        try {
            const response = await this.client.get('/v1/base/trending', { params: { limit } });
            return response.data.tokens || [];
        }
        catch (error) {
            this.logError('Trending tokens fetch failed', error.message);
            return [];
        }
    }
    /**
     * Get Clanker tokens specifically
     */
    async getClankerTokens() {
        try {
            const response = await this.client.get('/v1/base/clanker');
            return response.data.tokens || [];
        }
        catch (error) {
            this.logError('Clanker tokens fetch failed', error.message);
            return [];
        }
    }
    /**
     * Get Virtuals Protocol AI agent tokens on Base
     */
    async getVirtualsTokens() {
        try {
            const response = await this.client.get('/v1/base/virtuals');
            return response.data.tokens || [];
        }
        catch (error) {
            this.logError('Virtuals tokens fetch failed', error.message);
            return [];
        }
    }
    /**
     * Get all new tokens from Base
     */
    async getNewTokens(limit = 50, sortBy = 'volume') {
        try {
            const response = await this.client.get('/v1/base/new-tokens', { params: { limit, sortBy } });
            return response.data.tokens || [];
        }
        catch (error) {
            this.logError('New tokens fetch failed', error.message);
            return [];
        }
    }
    /**
     * Register a wallet for real-time transaction tracking
     */
    async trackWallet(address, chain, label) {
        try {
            const response = await this.client.post('/v1/wallets/track', { address, chain, label });
            return response.data.success;
        }
        catch (error) {
            this.logError(`Wallet tracking failed for ${address}`, error.message);
            return false;
        }
    }
    /**
     * Health check
     */
    async healthCheck() {
        try {
            // Health endpoint doesn't require auth
            const response = await axios_1.default.get(`${this.baseURL}/health`, { timeout: 5000 });
            return response.status === 200;
        }
        catch (error) {
            return false;
        }
    }
}
exports.BackendTeamClient = BackendTeamClient;
// Export singleton instance
exports.backendTeamClient = BackendTeamClient.getInstance();
