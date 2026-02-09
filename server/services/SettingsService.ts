import { db } from '../index';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as JSON5 from 'json5';

export class SettingsService {
    private static instance: SettingsService;

    private constructor() { }

    public static getInstance(): SettingsService {
        if (!SettingsService.instance) {
            SettingsService.instance = new SettingsService();
        }
        return SettingsService.instance;
    }

    public async get(key: string): Promise<string | null> {
        const result = await db.select().from(settings).where(eq(settings.key, key)).get();
        return result ? result.value : null;
    }

    public async getAll(): Promise<Record<string, string>> {
        const results = await db.select().from(settings).all();
        const map: Record<string, string> = {};
        for (const row of results) {
            map[row.key] = row.value;
        }
        return map;
    }

    public async set(key: string, value: string): Promise<void> {
        const existing = await db.select().from(settings).where(eq(settings.key, key)).get();
        if (existing) {
            await db.update(settings).set({ value, updatedAt: Date.now() }).where(eq(settings.key, key));
        } else {
            await db.insert(settings).values({ key, value, updatedAt: Date.now() });
        }

        // If it's a configuration key, sync with OpenClaw
        const configKeys = [
            'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY',
            'OLLAMA_HOST', 'OLLAMA_MODEL', 'USE_LOCAL_BRAIN',
            'DEFAULT_BRAIN_MODEL', 'BRAIN_TEMPERATURE', 'BRAIN_SYSTEM_PROMPT'
        ];
        if (configKeys.includes(key)) {
            await this.syncWithOpenClaw();
        }

        // If it's an RPC override, reload PortfolioService clients
        if (key === 'SOLANA_RPC_OVERRIDE' || key === 'EVM_RPC_OVERRIDE') {
            const { PortfolioService } = await import('./PortfolioService');
            const solUrl = await this.get('SOLANA_RPC_OVERRIDE');
            const evmUrl = await this.get('EVM_RPC_OVERRIDE');
            await PortfolioService.reloadRPCs(solUrl || undefined, evmUrl || undefined);
        }
    }

    public async syncWithOpenClaw(): Promise<void> {
        const { BrainBridgeService } = await import('./BrainBridge');
        const bridge = BrainBridgeService.getInstance();

        // Fetch all relevant settings from DB to build the sync object
        const keys = [
            'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY',
            'OLLAMA_HOST', 'OLLAMA_MODEL', 'USE_LOCAL_BRAIN',
            'DEFAULT_BRAIN_MODEL', 'BRAIN_TEMPERATURE', 'BRAIN_SYSTEM_PROMPT',
            'SOLANA_RPC_OVERRIDE', 'EVM_RPC_OVERRIDE'
        ];

        const settingsMap: Record<string, string> = {};
        for (const key of keys) {
            const val = await this.get(key);
            if (val) settingsMap[key] = val;
        }

        await bridge.syncBrainConfig(settingsMap);
    }
}
