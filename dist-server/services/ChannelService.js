"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelService = void 0;
const SettingsService_1 = require("./SettingsService");
const OpenClawConfigService_1 = require("./OpenClawConfigService");
/**
 * ChannelService - Manages multi-channel messaging configuration
 *
 * Handles saving/loading channel configs (Telegram, Discord, WhatsApp)
 * and regenerating the OpenClaw config when channels change.
 */
class ChannelService {
    static instance;
    constructor() { }
    static getInstance() {
        if (!ChannelService.instance) {
            ChannelService.instance = new ChannelService();
        }
        return ChannelService.instance;
    }
    /**
     * Validate Telegram bot token format (from @BotFather)
     */
    validateTelegramToken(token) {
        return /^\d+:[A-Za-z0-9_-]{35,}$/.test(token);
    }
    /**
     * Validate Discord bot token format
     */
    validateDiscordToken(token) {
        return token.length >= 50;
    }
    /**
     * Save a channel account configuration
     */
    async saveChannelConfig(channel, accountName, config) {
        const settingsService = SettingsService_1.SettingsService.getInstance();
        const currentConfig = await settingsService.getJSON('OPENCLAW_CHANNELS_CONFIG') || {};
        if (!currentConfig[channel]) {
            currentConfig[channel] = {};
        }
        currentConfig[channel][accountName] = config;
        await settingsService.setJSON('OPENCLAW_CHANNELS_CONFIG', currentConfig);
        await OpenClawConfigService_1.OpenClawConfigService.getInstance().generateConfig();
    }
    /**
     * Remove a channel account
     */
    async removeChannel(channel, accountName) {
        const settingsService = SettingsService_1.SettingsService.getInstance();
        const currentConfig = await settingsService.getJSON('OPENCLAW_CHANNELS_CONFIG') || {};
        if (currentConfig[channel]) {
            delete currentConfig[channel][accountName];
            if (Object.keys(currentConfig[channel]).length === 0) {
                delete currentConfig[channel];
            }
        }
        await settingsService.setJSON('OPENCLAW_CHANNELS_CONFIG', currentConfig);
        await OpenClawConfigService_1.OpenClawConfigService.getInstance().generateConfig();
    }
    /**
     * Get all configured channels (tokens masked for API responses)
     */
    async getChannels() {
        const settingsService = SettingsService_1.SettingsService.getInstance();
        return await settingsService.getJSON('OPENCLAW_CHANNELS_CONFIG') || {};
    }
    /**
     * Get channels with tokens masked for safe API response
     */
    async getChannelsMasked() {
        const config = await this.getChannels();
        const masked = {};
        for (const [channelName, accounts] of Object.entries(config)) {
            const maskedAccounts = {};
            for (const [acctName, acct] of Object.entries(accounts)) {
                maskedAccounts[acctName] = {
                    ...acct,
                    token: acct.token ? '********' + acct.token.slice(-4) : '',
                };
            }
            masked[channelName] = maskedAccounts;
        }
        return masked;
    }
    /**
     * Check if any channels are currently enabled
     */
    async isEnabled() {
        return await SettingsService_1.SettingsService.getInstance().getBoolean('OPENCLAW_CHANNELS_ENABLED');
    }
}
exports.ChannelService = ChannelService;
