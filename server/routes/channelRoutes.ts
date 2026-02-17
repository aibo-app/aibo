import { FastifyInstance } from 'fastify';
import { ChannelService } from '../services/ChannelService';
import { SettingsService } from '../services/SettingsService';
import type { ChannelAccountConfig } from '../types/settings';

const VALID_CHANNELS = new Set(['telegram', 'discord', 'whatsapp']);
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype', 'toString', 'valueOf']);
const MAX_NAME_LENGTH = 64;

export default async function channelRoutes(fastify: FastifyInstance) {
    const channelService = ChannelService.getInstance();

    // Get all configured channels (tokens masked)
    fastify.get('/api/channels', async () => {
        const channels = await channelService.getChannelsMasked();
        const enabled = await channelService.isEnabled();
        return { channels, enabled };
    });

    // Save a channel account config
    fastify.post<{
        Body: { channel: string; accountName: string; config: ChannelAccountConfig };
    }>('/api/channels', async (request, reply) => {
        const { channel, accountName, config } = request.body;

        if (!channel || !VALID_CHANNELS.has(channel)) {
            return reply.code(400).send({ error: 'Invalid channel. Must be telegram, discord, or whatsapp.' });
        }
        if (!accountName || typeof accountName !== 'string') {
            return reply.code(400).send({ error: 'Account name is required.' });
        }
        if (accountName.length > MAX_NAME_LENGTH || !/^[a-zA-Z0-9_-]+$/.test(accountName)) {
            return reply.code(400).send({ error: 'Account name must be alphanumeric (max 64 chars).' });
        }
        if (DANGEROUS_KEYS.has(accountName)) {
            return reply.code(400).send({ error: 'Invalid account name.' });
        }
        if (!config || typeof config !== 'object' || Array.isArray(config)) {
            return reply.code(400).send({ error: 'Config is required.' });
        }

        // Validate token format
        if (config.token && !config.token.startsWith('********')) {
            if (channel === 'telegram' && !channelService.validateTelegramToken(config.token)) {
                return reply.code(400).send({ error: 'Invalid Telegram bot token format. Get one from @BotFather.' });
            }
            if (channel === 'discord' && !channelService.validateDiscordToken(config.token)) {
                return reply.code(400).send({ error: 'Invalid Discord bot token.' });
            }
        }

        // If token is masked, preserve existing token
        if (config.token && config.token.startsWith('********')) {
            const existing = await channelService.getChannels();
            const existingAcct = (existing as any)[channel]?.[accountName];
            if (existingAcct) {
                config.token = existingAcct.token;
            }
        }

        await channelService.saveChannelConfig(channel as any, accountName, config);
        return { success: true };
    });

    // Delete a channel account
    fastify.delete<{
        Params: { channel: string; accountName: string };
    }>('/api/channels/:channel/:accountName', async (request, reply) => {
        const { channel, accountName } = request.params;

        if (!VALID_CHANNELS.has(channel)) {
            return reply.code(400).send({ error: 'Invalid channel.' });
        }

        await channelService.removeChannel(channel as any, accountName);
        return { success: true };
    });

    // Toggle channels globally (enable/disable all messaging)
    fastify.post<{ Body: { enabled: boolean } }>('/api/channels/toggle', async (request, reply) => {
        const { enabled } = request.body;
        if (typeof enabled !== 'boolean') {
            return reply.code(400).send({ error: 'enabled must be a boolean.' });
        }

        await SettingsService.getInstance().set('OPENCLAW_CHANNELS_ENABLED', String(enabled));
        return { success: true };
    });
}
