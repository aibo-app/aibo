import * as fs from 'fs';
import * as path from 'path';
import * as JSON5 from 'json5';

/**
 * BrainBridgeService
 * 
 * Formalized bridge between the Aibo "Body" (UI/Backend) and the OpenClaw "Brain".
 * This service encapsulates all implementation details of the Brain, 
 * including configuration synchronization and process-level health.
 */
export class BrainBridgeService {
    private static instance: BrainBridgeService;
    private configPath: string;
    private homeDir: string;

    private constructor() {
        this.homeDir = process.env.HOME || process.env.USERPROFILE || '';

        const userConfigPath = path.join(this.homeDir, '.openclaw', 'openclaw.json');
        const openClawDataDir = path.join(process.cwd(), 'server', 'openclaw-core', 'data');
        const internalConfigPath = path.join(openClawDataDir, 'openclaw.json');

        if (fs.existsSync(userConfigPath)) {
            this.configPath = userConfigPath;
        } else {
            this.configPath = internalConfigPath;
        }
    }

    public static getInstance(): BrainBridgeService {
        if (!BrainBridgeService.instance) {
            BrainBridgeService.instance = new BrainBridgeService();
        }
        return BrainBridgeService.instance;
    }

    /**
     * Synchronize a standardized configuration object with the Brain's persistent storage.
     * This moves configuration logic out of the general SettingsService.
     */
    public async syncBrainConfig(aiboSettings: Record<string, string>): Promise<void> {

        let currentConfig: any = {};
        if (fs.existsSync(this.configPath)) {
            try {
                const raw = fs.readFileSync(this.configPath, 'utf-8');
                currentConfig = JSON5.parse(raw);
            } catch (e) {
                console.error('❌ [BrainBridge] Failed to read current Brain config:', e);
            }
        }

        // Apply Aibo settings to the standard OpenClaw schema
        const newConfig = this.mapAiboToOpenClaw(aiboSettings, currentConfig);

        try {
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            fs.writeFileSync(this.configPath, JSON.stringify(newConfig, null, 2), 'utf-8');
            console.log('✅ [BrainBridge] Neural configuration synchronized.');
        } catch (e) {
            console.error('❌ [BrainBridge] Failed to write Brain config:', e);
            throw new Error('Config sync failure');
        }

        // Write system prompt to SOUL.md (Personality)
        if (aiboSettings.BRAIN_SYSTEM_PROMPT) {
            this.writeSoulFile(newConfig, aiboSettings.BRAIN_SYSTEM_PROMPT);
        }
    }

    private writeSoulFile(config: any, prompt: string): void {
        let workspaceDir: string;
        const agent = config.agents?.list?.[0];

        if (agent && agent.workspace) {
            workspaceDir = agent.workspace;
        } else {
            // Default OpenClaw workspace
            workspaceDir = path.join(this.homeDir, '.openclaw', 'workspace');
        }

        // Expand ~ if needed
        if (workspaceDir.startsWith('~')) {
            workspaceDir = path.join(this.homeDir, workspaceDir.slice(1));
        }

        try {
            if (!fs.existsSync(workspaceDir)) {
                fs.mkdirSync(workspaceDir, { recursive: true });
            }

            const soulPath = path.join(workspaceDir, 'SOUL.md');
            fs.writeFileSync(soulPath, prompt, 'utf-8');
        } catch (e) {
            console.error(`❌ [BrainBridge] Failed to write SOUL.md:`, e);
        }
    }

    private mapAiboToOpenClaw(aibo: Record<string, string>, current: any): any {
        const config = { ...current };

        // LLM Provider Definitions (Strict Schema Compliance)
        const providers: any = {};

        // 1. Anthropic
        providers.anthropic = {
            baseUrl: 'https://api.anthropic.com',
            api: 'anthropic-messages',
            apiKey: aibo.ANTHROPIC_API_KEY || (current.models?.providers?.anthropic?.apiKey) || 'env:ANTHROPIC_API_KEY',
            models: [
                { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', input: ['text', 'image'], contextWindow: 200000, maxTokens: 8192 },
                { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', input: ['text'], contextWindow: 200000, maxTokens: 8192 }
            ]
        };

        // 2. OpenAI
        providers.openai = {
            baseUrl: 'https://api.openai.com/v1',
            api: 'openai-completions',
            apiKey: aibo.OPENAI_API_KEY || (current.models?.providers?.openai?.apiKey) || 'env:OPENAI_API_KEY',
            models: [
                { id: 'gpt-4o', name: 'GPT-4o', input: ['text', 'image'], contextWindow: 128000, maxTokens: 4096 },
                { id: 'gpt-4o-mini', name: 'GPT-4o Mini', input: ['text', 'image'], contextWindow: 128000, maxTokens: 4096 }
            ]
        };

        // 3. DeepSeek
        providers.deepseek = {
            baseUrl: 'https://api.deepseek.com',
            api: 'openai-completions',
            apiKey: aibo.DEEPSEEK_API_KEY || (current.models?.providers?.deepseek?.apiKey) || 'env:DEEPSEEK_API_KEY',
            models: [
                { id: 'deepseek-chat', name: 'DeepSeek V3', input: ['text'], contextWindow: 64000, maxTokens: 8192 },
                { id: 'deepseek-reasoner', name: 'DeepSeek R1', reasoning: true, input: ['text'], contextWindow: 64000, maxTokens: 8192 }
            ]
        };

        // 4. Ollama
        const ollamaHost = aibo.OLLAMA_HOST || 'http://127.0.0.1:11434';
        providers.ollama = {
            baseUrl: ollamaHost.endsWith('/v1') ? ollamaHost : `${ollamaHost}/v1`,
            api: 'openai-completions',
            apiKey: 'ollama',
            models: aibo.OLLAMA_MODEL ? [{ id: aibo.OLLAMA_MODEL, name: aibo.OLLAMA_MODEL }] : []
        };

        if (!config.models) config.models = {};
        config.models.providers = providers;

        // Agent Logic
        if (!config.agents) config.agents = {};
        if (!config.agents.list) config.agents.list = [];

        // Find 'main' agent (created by default in openclaw.json) or fallback to first agent
        let brainAgent = config.agents.list.find((a: any) => a.id === 'main');
        if (!brainAgent && config.agents.list.length > 0) {
            brainAgent = config.agents.list[0];
        }

        // If still no agent, create one
        if (!brainAgent) {
            brainAgent = { id: 'main', name: 'Main Agent', model: 'openai/deepseek-chat' };
            config.agents.list.push(brainAgent);
        }

        let provider = '';
        let modelId = '';

        // Apply Expert Knobs & Model Selection
        if (aibo.DEFAULT_BRAIN_MODEL) {
            brainAgent.model = aibo.DEFAULT_BRAIN_MODEL;
            // Best-effort provider detection for custom strings
            if (brainAgent.model.includes('/')) {
                [provider, modelId] = brainAgent.model.split('/');
            } else {
                modelId = brainAgent.model;
            }
        } else if (aibo.USE_LOCAL_BRAIN === 'true' && aibo.OLLAMA_MODEL) {
            brainAgent.model = aibo.OLLAMA_MODEL;
            provider = 'ollama';
            modelId = aibo.OLLAMA_MODEL;
        } else if (aibo.ANTHROPIC_API_KEY) {
            brainAgent.model = 'claude-3-5-sonnet-latest';
            provider = 'anthropic';
            modelId = 'claude-3-5-sonnet-latest';
        } else if (aibo.OPENAI_API_KEY) {
            brainAgent.model = 'gpt-4o';
            provider = 'openai';
            modelId = 'gpt-4o';
        }

        // Apply Temperature via Defaults (Schema-Compliant)
        if (aibo.BRAIN_TEMPERATURE && provider && modelId) {
            if (!config.agents.defaults) config.agents.defaults = {};
            if (!config.agents.defaults.models) config.agents.defaults.models = {};

            const key = `${provider}/${modelId}`;
            const existing = config.agents.defaults.models[key] || {};
            config.agents.defaults.models[key] = {
                ...existing,
                params: {
                    ...(existing.params || {}),
                    temperature: parseFloat(aibo.BRAIN_TEMPERATURE)
                }
            };
        }

        return config;
    }
}
