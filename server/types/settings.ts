export const SETTING_KEYS = {
    // Existing brain settings
    OPENAI_API_KEY: 'OPENAI_API_KEY',
    ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
    DEEPSEEK_API_KEY: 'DEEPSEEK_API_KEY',
    USE_LOCAL_BRAIN: 'USE_LOCAL_BRAIN',
    OLLAMA_HOST: 'OLLAMA_HOST',
    OLLAMA_MODEL: 'OLLAMA_MODEL',
    DEFAULT_BRAIN_MODEL: 'DEFAULT_BRAIN_MODEL',
    BRAIN_TEMPERATURE: 'BRAIN_TEMPERATURE',
    BRAIN_SYSTEM_PROMPT: 'BRAIN_SYSTEM_PROMPT',
    TTS_VOICE_URI: 'TTS_VOICE_URI',
    EDGE_TTS_VOICE: 'EDGE_TTS_VOICE',

    // New channel settings (JSON)
    OPENCLAW_CHANNELS_CONFIG: 'OPENCLAW_CHANNELS_CONFIG',
    OPENCLAW_CHANNELS_ENABLED: 'OPENCLAW_CHANNELS_ENABLED', // boolean

    // Skill settings (JSON)
    OPENCLAW_SKILLS_CONFIG: 'OPENCLAW_SKILLS_CONFIG',

    // Cron/monitoring settings (JSON)
    OPENCLAW_CRON_JOBS: 'OPENCLAW_CRON_JOBS',
    OPENCLAW_MONITORING_ENABLED: 'OPENCLAW_MONITORING_ENABLED', // boolean

    // Chat history settings
    CHAT_HISTORY_WINDOW_SIZE: 'CHAT_HISTORY_WINDOW_SIZE', // number, default 10
    CHAT_ENABLE_SUMMARIZATION: 'CHAT_ENABLE_SUMMARIZATION', // boolean
    CHAT_MAX_TOKENS: 'CHAT_MAX_TOKENS', // number
} as const;

export type SettingKey = keyof typeof SETTING_KEYS;

// Channel config types
export interface ChannelAccountConfig {
    enabled: boolean;
    token: string; // bot token
    dmPolicy?: 'pairing' | 'allowlist' | 'open' | 'disabled';
}

export interface ChannelsConfig {
    telegram?: Record<string, ChannelAccountConfig>;
    discord?: Record<string, ChannelAccountConfig>;
    whatsapp?: Record<string, ChannelAccountConfig>;
}

// Skill config types
export interface SkillConfig {
    enabled: boolean;
    apiKey?: string;
    env?: Record<string, string>;
    config?: Record<string, unknown>;
}

export interface SkillsConfig {
    allowBundled?: string[]; // Empty = all allowed
    entries?: Record<string, SkillConfig>;
}

// Skill install instruction (from metadata.openclaw.install)
export interface SkillInstallOption {
    id: string;
    kind: string;          // brew, apt, npm, go, etc.
    formula?: string;      // brew formula
    package?: string;      // apt/npm package
    module?: string;       // go module
    tap?: string;          // brew tap
    bins: string[];        // binaries provided
    label: string;         // human-readable description
}

// Skill manifest (discovered from SKILL.md files)
export interface SkillManifest {
    id: string;
    name: string;
    description: string;
    emoji?: string;
    category?: string;
    source: 'bundled' | 'workspace';
    path: string;
    /** Node commands extracted from **Tool:** markers */
    commands: string[];
    /** Icon URL if icon file exists */
    icon?: string;
    /** Environment variables required by this skill (from metadata.openclaw.requires.env) */
    requiredEnv?: string[];
    /** Required binaries (all must be present) */
    requiredBins?: string[];
    /** Alternative binaries (at least one must be present) */
    anyBins?: string[];
    /** Installation instructions for missing dependencies */
    installOptions?: SkillInstallOption[];
    status: 'loaded' | 'error';
    error?: string;
}

// Cron job types
export interface CronJobConfig {
    id: string;
    name: string;
    enabled: boolean;
    schedule: {
        kind: 'cron' | 'every' | 'at';
        expr?: string; // For 'cron' kind
        everyMs?: number; // For 'every' kind
        at?: string; // For 'at' kind (ISO timestamp)
    };
    action: 'portfolio_summary' | 'price_alert' | 'custom_query';
    params?: Record<string, unknown>;
    deliverTo?: {
        channel: string;
        recipient: string;
    };
}
