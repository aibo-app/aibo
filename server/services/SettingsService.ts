import { db } from '../index';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';
import { SecretStoreService, SECRET_SETTING_KEYS } from './SecretStoreService';

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
export class SettingsService {
    private static instance: SettingsService;
    private restartTimer: ReturnType<typeof setTimeout> | null = null;
    private reloadTimer: ReturnType<typeof setTimeout> | null = null;

    private constructor() { }

    public static getInstance(): SettingsService {
        if (!SettingsService.instance) {
            SettingsService.instance = new SettingsService();
        }
        return SettingsService.instance;
    }

    public async get(key: string): Promise<string | null> {
        // Check keychain first for secret keys (macOS)
        if (SECRET_SETTING_KEYS.has(key)) {
            const keychainValue = SecretStoreService.getInstance().get(key);
            if (keychainValue) return keychainValue;
        }

        const result = await db.select().from(settings).where(eq(settings.key, key)).get();
        return result ? result.value : null;
    }

    public async getAll(): Promise<Record<string, string>> {
        const results = await db.select().from(settings).all();
        const map: Record<string, string> = {};
        for (const row of results) {
            map[row.key] = row.value;
        }

        // Override with keychain values for secret keys
        const secretStore = SecretStoreService.getInstance();
        for (const key of SECRET_SETTING_KEYS) {
            const keychainValue = secretStore.get(key);
            if (keychainValue) {
                map[key] = keychainValue;
            }
        }

        return map;
    }

    public async set(key: string, value: string): Promise<void> {
        // Store secrets in keychain when possible, keep masked placeholder in DB
        if (SECRET_SETTING_KEYS.has(key)) {
            const stored = SecretStoreService.getInstance().set(key, value);
            if (stored) {
                const placeholder = '********' + value.slice(-4);
                const existing = await db.select().from(settings).where(eq(settings.key, key)).get();
                if (existing) {
                    await db.update(settings).set({ value: placeholder, updatedAt: Date.now() }).where(eq(settings.key, key));
                } else {
                    await db.insert(settings).values({ key, value: placeholder, updatedAt: Date.now() });
                }
                if (RESTART_KEYS.has(key)) this.scheduleBrainRestart();
                else if (RELOAD_KEYS.has(key)) this.scheduleBrainReload();
                return;
            }
            // Keychain storage failed — fall through to DB
        }

        const existing = await db.select().from(settings).where(eq(settings.key, key)).get();
        if (existing) {
            await db.update(settings).set({ value, updatedAt: Date.now() }).where(eq(settings.key, key));
        } else {
            await db.insert(settings).values({ key, value, updatedAt: Date.now() });
        }

        if (RESTART_KEYS.has(key)) {
            this.scheduleBrainRestart();
        } else if (RELOAD_KEYS.has(key)) {
            this.scheduleBrainReload();
        }
    }

    public async getJSON<T>(key: string): Promise<T | null> {
        const value = await this.get(key);
        if (!value) return null;
        try {
            return JSON.parse(value) as T;
        } catch {
            return null;
        }
    }

    public async setJSON<T>(key: string, value: T): Promise<void> {
        await this.set(key, JSON.stringify(value));
    }

    public async getBoolean(key: string): Promise<boolean> {
        const value = await this.get(key);
        return value === 'true';
    }

    public async getNumber(key: string): Promise<number | null> {
        const value = await this.get(key);
        return value ? parseFloat(value) : null;
    }

    /**
     * Debounced Brain restart — waits 500ms after the last brain-related key change
     * so bulk saves (which call set() in a loop) only trigger one restart.
     */
    private scheduleBrainRestart(): void {
        if (this.restartTimer) clearTimeout(this.restartTimer);
        // A restart also cancels any pending reload (restart subsumes it)
        if (this.reloadTimer) { clearTimeout(this.reloadTimer); this.reloadTimer = null; }
        this.restartTimer = setTimeout(async () => {
            this.restartTimer = null;
            try {
                const { BrainManager } = await import('./BrainManager');
                console.log('⚙️ [SettingsService] Structural settings changed, restarting Brain...');
                await BrainManager.getInstance().restart();
            } catch (err) {
                console.error('⚙️ [SettingsService] Failed to restart Brain:', err);
            }
        }, 500);
    }

    /**
     * Debounced Brain hot-reload — sends SIGUSR1 instead of full restart.
     * Skipped if a full restart is already pending (restart subsumes reload).
     */
    private scheduleBrainReload(): void {
        if (this.restartTimer) return; // Restart already pending, don't downgrade
        if (this.reloadTimer) clearTimeout(this.reloadTimer);
        this.reloadTimer = setTimeout(async () => {
            this.reloadTimer = null;
            try {
                const { BrainManager } = await import('./BrainManager');
                console.log('⚡ [SettingsService] Config-only change, hot-reloading Brain...');
                await BrainManager.getInstance().reload();
            } catch (err) {
                console.error('⚡ [SettingsService] Failed to reload Brain:', err);
            }
        }, 500);
    }
}
