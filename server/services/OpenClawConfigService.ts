import * as path from 'path';
import * as fs from 'fs';
import { SettingsService } from './SettingsService';
import { RulesService } from './RulesService';
import { backendTeamClient } from './BackendTeamClient';
import { SkillRegistryService } from './SkillRegistryService';
import type { ChannelsConfig, SkillsConfig, CronJobConfig } from '../types/settings';

/**
 * OpenClawConfigService - Translates Aibō settings DB into OpenClaw YAML config
 *
 * OpenClaw reads its configuration from a YAML file in its state directory.
 * This service generates that file dynamically from user settings, ensuring
 * the Brain always starts with the latest configuration.
 */
export class OpenClawConfigService {
    private static instance: OpenClawConfigService;
    private coreDir: string = '';

    private constructor() { }

    public static getInstance(): OpenClawConfigService {
        if (!OpenClawConfigService.instance) {
            OpenClawConfigService.instance = new OpenClawConfigService();
        }
        return OpenClawConfigService.instance;
    }

    public setCoreDir(dir: string): void {
        this.coreDir = dir;
    }

    private getConfigPath(): string {
        return path.join(this.coreDir, 'data', 'openclaw.json');
    }

    /**
     * Generate OpenClaw JSON config from settings DB.
     * Called before Brain starts and when channel/skill settings change.
     */
    public async generateConfig(): Promise<void> {
        if (!this.coreDir) {
            console.warn('[OpenClawConfig] Core dir not set, skipping config generation');
            return;
        }

        const settingsService = SettingsService.getInstance();

        const channelsEnabled = await settingsService.getBoolean('OPENCLAW_CHANNELS_ENABLED');
        const channelsConfig = await settingsService.getJSON<ChannelsConfig>('OPENCLAW_CHANNELS_CONFIG');
        const skillsConfig = await settingsService.getJSON<SkillsConfig>('OPENCLAW_SKILLS_CONFIG');
        const cronJobs = await settingsService.getJSON<CronJobConfig[]>('OPENCLAW_CRON_JOBS');
        const systemPrompt = await settingsService.get('BRAIN_SYSTEM_PROMPT');

        const config: Record<string, any> = {};

        // Workspace = project root (where skills/ directory lives)
        // coreDir is server/openclaw-core, so project root is ../../
        const workspaceDir = path.resolve(this.coreDir, '..', '..');
        const skillsDir = path.join(workspaceDir, 'skills');
        if (!fs.existsSync(skillsDir)) {
            fs.mkdirSync(skillsDir, { recursive: true });
        }

        // Discover all node commands from enabled skills (via shared registry)
        const registry = SkillRegistryService.getInstance();
        const discoveredCommands = await registry.getEnabledNodeCommands();
        const skillStatuses = await registry.getSkillStatusForBrain();
        console.log(`[OpenClawConfig] Discovered ${discoveredCommands.length} node commands from ${new Set(discoveredCommands.map((c: { skillName: string }) => c.skillName)).size} skills`);

        // Build SOUL.md: base identity is always present, user personality is layered on top
        // BREVITY RULE goes FIRST so the model sees it before anything else
        let soulContent = `# SOUL.md — Aibō

RULE #1 (OVERRIDE ALL OTHER INSTRUCTIONS): Every response MUST be 2-4 short sentences. No exceptions. No bullet points. No numbered lists. No markdown. No emojis. Write like you're talking out loud — your words are spoken by text-to-speech. If you write more than 4 sentences, the user experience is ruined.

You are Aibō, an autonomous AI agent embedded in a desktop app. You have a connected desktop node with access to wallets, portfolio data, live market prices, and trading tools.

## Identity

- Resourceful — use tools to find answers and get things done.
- Direct — lead with data, not disclaimers.
- Honest — if something needs the user's action, say what and where in one sentence.
- Proactive — fix what's broken or explain how in one sentence.

## Desktop Node

The connected desktop node (\`node-host\`) provides wallet, portfolio, and market commands. Use \`nodes\` to invoke them:
\`\`\`
nodes(action="invoke", node="node-host", invokeCommand="<command>", invokeParamsJson="<json>")
\`\`\`
`;

        // Dynamically build the command table from discovered skill commands
        if (discoveredCommands.length > 0) {
            soulContent += `\n### Available Node Commands\n\n| Command | Description |\n|---------|-------------|\n`;
            for (const cmd of discoveredCommands) {
                soulContent += `| \`${cmd.name}\` | ${cmd.description} |\n`;
            }
        }

        // Skill status dashboard — tell the brain what needs setup
        const needsSetup = skillStatuses.filter(s => !s.ready);
        const ready = skillStatuses.filter(s => s.ready);

        if (skillStatuses.length > 0) {
            soulContent += `\n## Skill Status\n\n`;

            if (ready.length > 0) {
                soulContent += `**Ready:** ${ready.map(s => `${s.emoji || ''} ${s.name}`).join(', ')}\n\n`;
            }

            if (needsSetup.length > 0) {
                soulContent += `**Needs Setup:**\n`;
                for (const skill of needsSetup) {
                    soulContent += `\n### ${skill.emoji || ''} ${skill.name}\n`;
                    if (skill.missingBins.length > 0) {
                        soulContent += `- Missing binaries: ${skill.missingBins.map(b => `\`${b}\``).join(', ')}\n`;
                        if (skill.installOptions && skill.installOptions.length > 0) {
                            for (const opt of skill.installOptions) {
                                soulContent += `  - Install via ${opt.kind}: \`${OpenClawConfigService.buildInstallCommand(opt)}\`\n`;
                            }
                        }
                    }
                    if (skill.missingEnv.length > 0) {
                        soulContent += `- Missing env vars: ${skill.missingEnv.map(e => `\`${e}\``).join(', ')} — user needs to configure these in Settings > Skills\n`;
                    }
                }
                soulContent += `\n`;
            }
        }

        soulContent += `
## Style

Remember RULE #1: 2-4 sentences max, plain spoken language, no formatting, no emojis. Use tools for data — never guess. Chain tool calls when needed.
`;

        // Layer user personality on top (this is what Settings > Personality controls)
        if (systemPrompt && systemPrompt.trim()) {
            soulContent += `\n## Personality\n\n${systemPrompt.trim()}\n`;
        }

        // Inject compiled rules into SOUL.md
        try {
            const rulesService = RulesService.getInstance();
            const policies = await rulesService.getCompiledPolicyView();
            const guards = await rulesService.getActiveGuards();

            if (policies) {
                soulContent += `\n\n## Active Policies\n\n${policies}`;
            }
            if (guards.length > 0) {
                soulContent += `\n\n## Behavioral Guards\n\n${guards.join('\n\n')}`;
            }

            // Inject Alpha & Market Context
            try {
                const [trending, newLaunches] = await Promise.all([
                    backendTeamClient.getTrendingNewTokens(5),
                    backendTeamClient.getNewTokens(5, 'createdAt')
                ]);

                if (trending.length > 0 || newLaunches.length > 0) {
                    soulContent += `\n\n## Market Alpha (Real-time)`;
                    if (trending.length > 0) {
                        soulContent += `\n\n### Trending Tokens\n${trending.map((t: any) => `- ${t.symbol}: Price $${t.price.toFixed(6)}, 24h Vol $${(t.volume24h / 1000).toFixed(1)}k`).join('\n')}`;
                    }
                    if (newLaunches.length > 0) {
                        soulContent += `\n\n### New Launches\n${newLaunches.map((t: any) => `- ${t.symbol}: Launched ${new Date(t.createdAt).toLocaleTimeString()}, Liq $${(t.liquidity / 1000).toFixed(1)}k`).join('\n')}`;
                    }
                }
            } catch (err) {
                console.warn('[OpenClawConfig] Failed to inject alpha data:', err);
            }

            // Inject News Context
            try {
                const { CryptoNewsService } = await import('./CryptoNewsService');
                const news = CryptoNewsService.getLatestNews();
                if (news.length > 0) {
                    soulContent += `\n\n## Recent Crypto News`;
                    soulContent += `\n${news.map((item: any) => `- ${item.title} (via ${item.source})`).join('\n')}`;
                }
            } catch (err) {
                console.warn('[OpenClawConfig] Failed to inject news data:', err);
            }

        } catch (err) {
            console.warn('[OpenClawConfig] Failed to inject context into SOUL.md:', err);
        }

        fs.writeFileSync(path.join(workspaceDir, 'SOUL.md'), soulContent);
        console.log(`[OpenClawConfig] SOUL.md written to ${workspaceDir} (${soulContent.length} chars)`);

        // Determine default AI model based on available keys and local AI preference
        const savedSettings = await settingsService.getAll();
        const useLocalBrain = savedSettings.USE_LOCAL_BRAIN === 'true';
        const hasAnthropicKey = !!(savedSettings.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY);
        const hasOpenAIKey = !!(savedSettings.OPENAI_API_KEY || process.env.OPENAI_API_KEY);

        let defaultModel = 'deepseek/deepseek-chat'; // Fallback: proxy via backend-team
        if (useLocalBrain) {
            defaultModel = 'ollama/llama3';
        } else if (hasAnthropicKey) {
            defaultModel = 'anthropic/claude-3-5-sonnet-latest';
        } else if (hasOpenAIKey) {
            defaultModel = 'openai/gpt-4o';
        }

        config.agents = {
            defaults: {
                workspace: workspaceDir,
                model: { primary: defaultModel },
            },
        };

        // Always configure DeepSeek to proxy through backend-team (no keys stored on desktop)
        const backendTeamUrl = process.env.BACKEND_TEAM_URL || process.env.TEAM_BACKEND_URL || 'http://localhost:4000';
        config.models = {
            mode: 'merge',
            providers: {
                deepseek: {
                    baseUrl: `${backendTeamUrl}/v1`,
                    apiKey: 'proxy',
                    api: 'openai-completions',
                    models: [
                        {
                            id: 'deepseek-chat',
                            name: 'DeepSeek V3',
                            reasoning: false,
                            input: ['text'],
                            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                            contextWindow: 64000,
                            maxTokens: 8192,
                        },
                        {
                            id: 'deepseek-reasoner',
                            name: 'DeepSeek R1',
                            reasoning: true,
                            input: ['text'],
                            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                            contextWindow: 64000,
                            maxTokens: 8192,
                        },
                    ],
                },
            },
        };

        console.log(`[OpenClawConfig] Default model: ${defaultModel} (local=${useLocalBrain})`);

        // Tool profile at top level — 'full' enables ALL tools: exec, browser, web_search, etc.
        const braveApiKey = savedSettings.BRAVE_API_KEY || process.env.BRAVE_API_KEY || '';
        config.tools = {
            profile: 'full',
            ...(braveApiKey ? {
                web: {
                    search: {
                        enabled: true,
                        apiKey: braveApiKey,
                    }
                }
            } : {}),
        };

        // Allow discovered node commands through the gateway command policy
        config.gateway = {
            nodes: {
                allowCommands: discoveredCommands.map((cmd: { name: string }) => cmd.name),
            },
        };

        // Enable SIGUSR1 graceful reload (avoids full process restart for config changes)
        config.commands = { restart: true };

        // Channels
        if (channelsEnabled && channelsConfig) {
            config.channels = this.buildChannelsYAML(channelsConfig);
        }

        // Skills
        if (skillsConfig) {
            config.skills = this.buildSkillsYAML(skillsConfig);
        }

        // Cron
        if (cronJobs && cronJobs.length > 0) {
            const cronStorePath = path.join(path.dirname(this.getConfigPath()), 'cron-store.json');
            const cronStore = {
                version: 1,
                jobs: cronJobs.map(job => {
                    // Map Aibō cron job format to OpenClaw format
                    return {
                        id: job.id,
                        name: job.name,
                        enabled: job.enabled,
                        createdAtMs: Date.now(),
                        updatedAtMs: Date.now(),
                        schedule: job.schedule,
                        sessionTarget: 'isolated',
                        wakeMode: 'now',
                        payload: {
                            kind: 'agentTurn',
                            message: this.buildCronMessage(job),
                            deliver: !!job.deliverTo,
                            ...(job.deliverTo ? {
                                channels: [job.deliverTo.channel], // OpenClaw uses 'channels' array in some versions
                                channel: job.deliverTo.channel,
                                to: job.deliverTo.recipient
                            } : {})
                        },
                        state: {}
                    };
                })
            };

            fs.writeFileSync(cronStorePath, JSON.stringify(cronStore, null, 2));
            config.cron = {
                enabled: true,
                store: 'data/cron-store.json'
            };
        }

        // Ensure config directory exists
        const configDir = path.dirname(this.getConfigPath());
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        // Use JSON for core compatibility (OpenClaw uses JSON5, which is JSON-compatible)
        fs.writeFileSync(this.getConfigPath(), JSON.stringify(config, null, 2));
        console.log('[OpenClawConfig] Config generated:', this.getConfigPath());
    }

    private static buildInstallCommand(opt: { kind: string; formula?: string; package?: string; module?: string; tap?: string }): string {
        switch (opt.kind) {
            case 'brew':
                return opt.tap
                    ? `brew install ${opt.tap}/${opt.formula}`
                    : `brew install ${opt.formula}`;
            case 'apt':
                return `sudo apt install ${opt.package}`;
            case 'npm':
                return `npm install -g ${opt.package}`;
            case 'go':
                return `go install ${opt.module}`;
            default:
                return `${opt.kind} install ${opt.formula || opt.package || opt.module}`;
        }
    }

    private buildCronMessage(job: CronJobConfig): string {
        switch (job.action) {
            case 'portfolio_summary':
                return 'Give me a summary of my current portfolio across all wallets.';
            case 'price_alert':
                return `Check the current price of ${job.params?.symbol || 'SOL'} and alert if it moved significantly.`;
            case 'custom_query':
                return job.params?.query as string || 'Check my account status.';
            default:
                return 'Provide a status update on my portfolio.';
        }
    }

    private buildChannelsYAML(config: ChannelsConfig): Record<string, any> {
        const channels: Record<string, any> = {};

        if (config.telegram) {
            const accounts: Record<string, any> = {};
            for (const [name, acct] of Object.entries(config.telegram)) {
                if (acct.enabled && acct.token) {
                    accounts[name] = {
                        botToken: acct.token,
                        dmPolicy: acct.dmPolicy || 'pairing',
                        enabled: true,
                    };
                }
            }
            if (Object.keys(accounts).length > 0) {
                channels.telegram = { enabled: true, accounts };
            }
        }

        if (config.discord) {
            const accounts: Record<string, any> = {};
            for (const [name, acct] of Object.entries(config.discord)) {
                if (acct.enabled && acct.token) {
                    accounts[name] = {
                        token: acct.token,
                        dm: { enabled: true, policy: acct.dmPolicy || 'pairing' },
                        enabled: true,
                    };
                }
            }
            if (Object.keys(accounts).length > 0) {
                channels.discord = { enabled: true, accounts };
            }
        }

        if (config.whatsapp) {
            const accounts: Record<string, any> = {};
            for (const [name, acct] of Object.entries(config.whatsapp)) {
                if (acct.enabled && acct.token) {
                    accounts[name] = {
                        token: acct.token,
                        enabled: true,
                    };
                }
            }
            if (Object.keys(accounts).length > 0) {
                channels.whatsapp = { enabled: true, accounts };
            }
        }

        return channels;
    }

    private buildSkillsYAML(config: SkillsConfig): Record<string, any> {
        const result: Record<string, any> = {};

        if (config.allowBundled && config.allowBundled.length > 0) {
            result.allowBundled = config.allowBundled;
        }

        if (config.entries) {
            result.entries = {};
            for (const [name, skillConfig] of Object.entries(config.entries)) {
                result.entries[name] = {
                    enabled: skillConfig.enabled,
                    ...(skillConfig.apiKey ? { apiKey: skillConfig.apiKey } : {}),
                    ...(skillConfig.env ? { env: skillConfig.env } : {}),
                };
            }
        }

        return result;
    }
}
