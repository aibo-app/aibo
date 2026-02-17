import { SettingsService } from './SettingsService';
import { OpenClawConfigService } from './OpenClawConfigService';
import type { ChannelsConfig, ChannelAccountConfig } from '../types/settings';

/**
 * ChannelService - Manages multi-channel messaging configuration
 *
 * Handles saving/loading channel configs (Telegram, Discord, WhatsApp)
 * and regenerating the OpenClaw config when channels change.
 */
export class ChannelService {
    private static instance: ChannelService;

    private constructor() {}

    public static getInstance(): ChannelService {
        if (!ChannelService.instance) {
            ChannelService.instance = new ChannelService();
        }
        return ChannelService.instance;
    }

    /**
     * Validate Telegram bot token format (from @BotFather)
     */
    public validateTelegramToken(token: string): boolean {
        return /^\d+:[A-Za-z0-9_-]{35,}$/.test(token);
    }

    /**
     * Validate Discord bot token format
     */
    public validateDiscordToken(token: string): boolean {
        return token.length >= 50;
    }

    /**
     * Save a channel account configuration
     */
    public async saveChannelConfig(
        channel: 'telegram' | 'discord' | 'whatsapp',
        accountName: string,
        config: ChannelAccountConfig
    ): Promise<void> {
        const settingsService = SettingsService.getInstance();
        const currentConfig = await settingsService.getJSON<ChannelsConfig>('OPENCLAW_CHANNELS_CONFIG') || {};

        if (!currentConfig[channel]) {
            currentConfig[channel] = {};
        }
        currentConfig[channel]![accountName] = config;

        await settingsService.setJSON('OPENCLAW_CHANNELS_CONFIG', currentConfig);
        await OpenClawConfigService.getInstance().generateConfig();
    }

    /**
     * Remove a channel account
     */
    public async removeChannel(channel: 'telegram' | 'discord' | 'whatsapp', accountName: string): Promise<void> {
        const settingsService = SettingsService.getInstance();
        const currentConfig = await settingsService.getJSON<ChannelsConfig>('OPENCLAW_CHANNELS_CONFIG') || {};

        if (currentConfig[channel]) {
            delete currentConfig[channel]![accountName];
            if (Object.keys(currentConfig[channel]!).length === 0) {
                delete currentConfig[channel];
            }
        }

        await settingsService.setJSON('OPENCLAW_CHANNELS_CONFIG', currentConfig);
        await OpenClawConfigService.getInstance().generateConfig();
    }

    /**
     * Get all configured channels (tokens masked for API responses)
     */
    public async getChannels(): Promise<ChannelsConfig> {
        const settingsService = SettingsService.getInstance();
        return await settingsService.getJSON<ChannelsConfig>('OPENCLAW_CHANNELS_CONFIG') || {};
    }

    /**
     * Get channels with tokens masked for safe API response
     */
    public async getChannelsMasked(): Promise<ChannelsConfig> {
        const config = await this.getChannels();
        const masked: ChannelsConfig = {};

        for (const [channelName, accounts] of Object.entries(config)) {
            const maskedAccounts: Record<string, ChannelAccountConfig> = {};
            for (const [acctName, acct] of Object.entries(accounts as Record<string, ChannelAccountConfig>)) {
                maskedAccounts[acctName] = {
                    ...acct,
                    token: acct.token ? '********' + acct.token.slice(-4) : '',
                };
            }
            (masked as any)[channelName] = maskedAccounts;
        }

        return masked;
    }

    /**
     * Check if any channels are currently enabled
     */
    public async isEnabled(): Promise<boolean> {
        return await SettingsService.getInstance().getBoolean('OPENCLAW_CHANNELS_ENABLED');
    }
}
