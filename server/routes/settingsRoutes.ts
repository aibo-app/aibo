import { FastifyInstance } from 'fastify';
import { SettingsService } from '../services/SettingsService';

export default async function settingsRoutes(fastify: FastifyInstance) {
    const settingsService = SettingsService.getInstance();

    // GET all settings (flattened for frontend)
    fastify.get('/api/settings', async () => {
        const allSettings = await settingsService.getAll();

        // Mask secrets
        const secrets = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY'];
        for (const key of secrets) {
            if (allSettings[key]) {
                allSettings[key] = '********' + allSettings[key].slice(-4);
            }
        }

        return {
            ...allSettings,
            hasOpenai: !!allSettings.OPENAI_API_KEY,
            hasAnthropic: !!allSettings.ANTHROPIC_API_KEY,
            hasDeepseek: !!allSettings.DEEPSEEK_API_KEY
        };
    });

    // POST update a setting
    fastify.post('/api/settings', async (request, reply) => {
        const { key, value } = request.body as { key: string; value: string };

        if (!key) {
            return reply.code(400).send({ error: 'Key is required' });
        }

        try {
            await settingsService.set(key, value);
            return { success: true };
        } catch (err: unknown) {
            console.error('[SettingsRoutes] Error setting key:', err);
            return reply.code(500).send({ error: 'Failed to update setting' });
        }
    });

    // POST bulk update settings
    fastify.post('/api/settings/bulk', async (request, reply) => {
        const payload = request.body as Record<string, string>;

        try {
            for (const [key, value] of Object.entries(payload)) {
                // If value is masked, don't update it
                if (value.startsWith('********')) continue;
                await settingsService.set(key, value);
            }
            return { success: true };
        } catch (err: unknown) {
            console.error('[SettingsRoutes] Error in bulk update:', err);
            return reply.code(500).send({ error: 'Failed to update settings' });
        }
    });
}
