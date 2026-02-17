"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = settingsRoutes;
const SettingsService_1 = require("../services/SettingsService");
// Centralized whitelist — applies to BOTH single-key and bulk updates
const ALLOWED_SETTINGS = new Set([
    'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY',
    'USE_LOCAL_BRAIN', 'OLLAMA_HOST', 'OLLAMA_MODEL', 'DEFAULT_BRAIN_MODEL',
    'BRAIN_TEMPERATURE', 'BRAIN_SYSTEM_PROMPT', 'TTS_VOICE_URI', 'EDGE_TTS_VOICE',
    'OPENCLAW_CHANNELS_CONFIG', 'OPENCLAW_CHANNELS_ENABLED',
    'OPENCLAW_SKILLS_CONFIG', 'OPENCLAW_CRON_JOBS', 'OPENCLAW_MONITORING_ENABLED',
    'CHAT_HISTORY_WINDOW_SIZE', 'CHAT_ENABLE_SUMMARIZATION', 'CHAT_MAX_TOKENS',
]);
// Settings whose values contain embedded secrets (stored as JSON with tokens inside)
const JSON_SECRET_KEYS = new Set(['OPENCLAW_CHANNELS_CONFIG']);
// Plain secret keys (API keys etc.)
const SECRET_KEYS = new Set(['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY']);
async function settingsRoutes(fastify) {
    const settingsService = SettingsService_1.SettingsService.getInstance();
    // GET all settings (flattened for frontend)
    fastify.get('/api/settings', async () => {
        const allSettings = await settingsService.getAll();
        // Mask plain API key secrets
        for (const key of SECRET_KEYS) {
            if (allSettings[key]) {
                allSettings[key] = '********' + allSettings[key].slice(-4);
            }
        }
        // Mask secrets embedded in JSON values (channel bot tokens)
        for (const key of JSON_SECRET_KEYS) {
            if (allSettings[key]) {
                try {
                    const parsed = JSON.parse(allSettings[key]);
                    maskNestedTokens(parsed);
                    allSettings[key] = JSON.stringify(parsed);
                }
                catch {
                    // Not valid JSON, leave as-is
                }
            }
        }
        return {
            ...allSettings,
            hasOpenai: !!allSettings.OPENAI_API_KEY,
            hasAnthropic: !!allSettings.ANTHROPIC_API_KEY,
            hasDeepseek: !!allSettings.DEEPSEEK_API_KEY
        };
    });
    // POST update a single setting (same whitelist as bulk)
    fastify.post('/api/settings', async (request, reply) => {
        const { key, value } = request.body;
        if (!key) {
            return reply.code(400).send({ error: 'Key is required' });
        }
        if (!ALLOWED_SETTINGS.has(key)) {
            return reply.code(403).send({ error: 'Setting key not allowed' });
        }
        // Don't overwrite secrets with masked values
        if (typeof value === 'string' && value.startsWith('********')) {
            return { success: true };
        }
        try {
            await settingsService.set(key, value);
            return { success: true };
        }
        catch (err) {
            console.error('[SettingsRoutes] Error setting key:', err);
            return reply.code(500).send({ error: 'Failed to update setting' });
        }
    });
    // POST bulk update settings
    fastify.post('/api/settings/bulk', async (request, reply) => {
        const payload = request.body;
        try {
            for (const [key, value] of Object.entries(payload)) {
                // Only allow known settings keys
                if (!ALLOWED_SETTINGS.has(key))
                    continue;
                // If value is masked, don't update it
                if (typeof value === 'string' && value.startsWith('********'))
                    continue;
                await settingsService.set(key, typeof value === 'string' ? value : String(value));
            }
            return { success: true };
        }
        catch (err) {
            console.error('[SettingsRoutes] Error in bulk update:', err);
            return reply.code(500).send({ error: 'Failed to update settings' });
        }
    });
}
/**
 * Recursively mask any 'token' or 'botToken' fields in a nested object.
 * Used to prevent channel bot tokens from leaking via GET /api/settings.
 */
function maskNestedTokens(obj) {
    if (!obj || typeof obj !== 'object')
        return;
    for (const key of Object.keys(obj)) {
        if ((key === 'token' || key === 'botToken') && typeof obj[key] === 'string' && obj[key].length > 0) {
            obj[key] = '********' + obj[key].slice(-4);
        }
        else if (typeof obj[key] === 'object') {
            maskNestedTokens(obj[key]);
        }
    }
}
