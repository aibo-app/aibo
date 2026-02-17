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
exports.SettingsService = void 0;
const index_1 = require("../index");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const SecretStoreService_1 = require("./SecretStoreService");
// Config-only changes: hot-reload via SIGUSR1 (no process restart)
const RELOAD_KEYS = new Set([
    'DEFAULT_BRAIN_MODEL',
    'BRAIN_TEMPERATURE',
    'BRAIN_SYSTEM_PROMPT',
    'OPENCLAW_SKILLS_CONFIG',
]);
// Structural changes: require full process restart (env vars, API keys, channels)
const RESTART_KEYS = new Set([
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'DEEPSEEK_API_KEY',
    'USE_LOCAL_BRAIN',
    'OLLAMA_HOST',
    'OLLAMA_MODEL',
    'OPENCLAW_CHANNELS_ENABLED',
]);
/**
 * SettingsService - Manages application settings stored in SQLite database
 *
 * For OpenClaw wrapper architecture:
 * - Settings are stored ONLY in the app database
 * - BrainManager reads settings on startup and passes via env vars
 * - If Brain-related settings change, Brain is automatically restarted
 */
class SettingsService {
    static instance;
    restartTimer = null;
    reloadTimer = null;
    constructor() { }
    static getInstance() {
        if (!SettingsService.instance) {
            SettingsService.instance = new SettingsService();
        }
        return SettingsService.instance;
    }
    async get(key) {
        // Check keychain first for secret keys (macOS)
        if (SecretStoreService_1.SECRET_SETTING_KEYS.has(key)) {
            const keychainValue = SecretStoreService_1.SecretStoreService.getInstance().get(key);
            if (keychainValue)
                return keychainValue;
        }
        const result = await index_1.db.select().from(schema_1.settings).where((0, drizzle_orm_1.eq)(schema_1.settings.key, key)).get();
        return result ? result.value : null;
    }
    async getAll() {
        const results = await index_1.db.select().from(schema_1.settings).all();
        const map = {};
        for (const row of results) {
            map[row.key] = row.value;
        }
        // Override with keychain values for secret keys
        const secretStore = SecretStoreService_1.SecretStoreService.getInstance();
        for (const key of SecretStoreService_1.SECRET_SETTING_KEYS) {
            const keychainValue = secretStore.get(key);
            if (keychainValue) {
                map[key] = keychainValue;
            }
        }
        return map;
    }
    async set(key, value) {
        // Store secrets in keychain when possible, keep masked placeholder in DB
        if (SecretStoreService_1.SECRET_SETTING_KEYS.has(key)) {
            const stored = SecretStoreService_1.SecretStoreService.getInstance().set(key, value);
            if (stored) {
                const placeholder = '********' + value.slice(-4);
                const existing = await index_1.db.select().from(schema_1.settings).where((0, drizzle_orm_1.eq)(schema_1.settings.key, key)).get();
                if (existing) {
                    await index_1.db.update(schema_1.settings).set({ value: placeholder, updatedAt: Date.now() }).where((0, drizzle_orm_1.eq)(schema_1.settings.key, key));
                }
                else {
                    await index_1.db.insert(schema_1.settings).values({ key, value: placeholder, updatedAt: Date.now() });
                }
                if (RESTART_KEYS.has(key))
                    this.scheduleBrainRestart();
                else if (RELOAD_KEYS.has(key))
                    this.scheduleBrainReload();
                return;
            }
            // Keychain storage failed — fall through to DB
        }
        const existing = await index_1.db.select().from(schema_1.settings).where((0, drizzle_orm_1.eq)(schema_1.settings.key, key)).get();
        if (existing) {
            await index_1.db.update(schema_1.settings).set({ value, updatedAt: Date.now() }).where((0, drizzle_orm_1.eq)(schema_1.settings.key, key));
        }
        else {
            await index_1.db.insert(schema_1.settings).values({ key, value, updatedAt: Date.now() });
        }
        if (RESTART_KEYS.has(key)) {
            this.scheduleBrainRestart();
        }
        else if (RELOAD_KEYS.has(key)) {
            this.scheduleBrainReload();
        }
    }
    async getJSON(key) {
        const value = await this.get(key);
        if (!value)
            return null;
        try {
            return JSON.parse(value);
        }
        catch {
            return null;
        }
    }
    async setJSON(key, value) {
        await this.set(key, JSON.stringify(value));
    }
    async getBoolean(key) {
        const value = await this.get(key);
        return value === 'true';
    }
    async getNumber(key) {
        const value = await this.get(key);
        return value ? parseFloat(value) : null;
    }
    /**
     * Debounced Brain restart — waits 500ms after the last brain-related key change
     * so bulk saves (which call set() in a loop) only trigger one restart.
     */
    scheduleBrainRestart() {
        if (this.restartTimer)
            clearTimeout(this.restartTimer);
        // A restart also cancels any pending reload (restart subsumes it)
        if (this.reloadTimer) {
            clearTimeout(this.reloadTimer);
            this.reloadTimer = null;
        }
        this.restartTimer = setTimeout(async () => {
            this.restartTimer = null;
            try {
                const { BrainManager } = await Promise.resolve().then(() => __importStar(require('./BrainManager')));
                console.log('⚙️ [SettingsService] Structural settings changed, restarting Brain...');
                await BrainManager.getInstance().restart();
            }
            catch (err) {
                console.error('⚙️ [SettingsService] Failed to restart Brain:', err);
            }
        }, 500);
    }
    /**
     * Debounced Brain hot-reload — sends SIGUSR1 instead of full restart.
     * Skipped if a full restart is already pending (restart subsumes reload).
     */
    scheduleBrainReload() {
        if (this.restartTimer)
            return; // Restart already pending, don't downgrade
        if (this.reloadTimer)
            clearTimeout(this.reloadTimer);
        this.reloadTimer = setTimeout(async () => {
            this.reloadTimer = null;
            try {
                const { BrainManager } = await Promise.resolve().then(() => __importStar(require('./BrainManager')));
                console.log('⚡ [SettingsService] Config-only change, hot-reloading Brain...');
                await BrainManager.getInstance().reload();
            }
            catch (err) {
                console.error('⚡ [SettingsService] Failed to reload Brain:', err);
            }
        }, 500);
    }
}
exports.SettingsService = SettingsService;
