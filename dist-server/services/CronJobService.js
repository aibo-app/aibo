"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronJobService = void 0;
const SettingsService_1 = require("./SettingsService");
const OpenClawConfigService_1 = require("./OpenClawConfigService");
/**
 * CronJobService - Manages proactive monitoring cron jobs
 *
 * Allows creating, updating, and deleting scheduled tasks that
 * OpenClaw will execute on a schedule (portfolio checks, alerts, etc.)
 */
class CronJobService {
    static instance;
    constructor() { }
    static getInstance() {
        if (!CronJobService.instance) {
            CronJobService.instance = new CronJobService();
        }
        return CronJobService.instance;
    }
    /**
     * Get all configured cron jobs
     */
    async getCronJobs() {
        const settingsService = SettingsService_1.SettingsService.getInstance();
        return await settingsService.getJSON('OPENCLAW_CRON_JOBS') || [];
    }
    /**
     * Save or update a cron job
     */
    async saveCronJob(job) {
        const jobs = await this.getCronJobs();
        const index = jobs.findIndex(j => j.id === job.id);
        if (index >= 0) {
            jobs[index] = job;
        }
        else {
            jobs.push(job);
        }
        const settingsService = SettingsService_1.SettingsService.getInstance();
        await settingsService.setJSON('OPENCLAW_CRON_JOBS', jobs);
        await OpenClawConfigService_1.OpenClawConfigService.getInstance().generateConfig();
    }
    /**
     * Delete a cron job by ID
     */
    async deleteCronJob(id) {
        const jobs = await this.getCronJobs();
        const filtered = jobs.filter(j => j.id !== id);
        const settingsService = SettingsService_1.SettingsService.getInstance();
        await settingsService.setJSON('OPENCLAW_CRON_JOBS', filtered);
        await OpenClawConfigService_1.OpenClawConfigService.getInstance().generateConfig();
    }
    /**
     * Toggle a cron job's enabled state
     */
    async toggleCronJob(id, enabled) {
        const jobs = await this.getCronJobs();
        const job = jobs.find(j => j.id === id);
        if (job) {
            job.enabled = enabled;
            const settingsService = SettingsService_1.SettingsService.getInstance();
            await settingsService.setJSON('OPENCLAW_CRON_JOBS', jobs);
            await OpenClawConfigService_1.OpenClawConfigService.getInstance().generateConfig();
        }
    }
    /**
     * Validate a cron expression (basic check)
     */
    validateCronExpression(expr) {
        const parts = expr.trim().split(/\s+/);
        return parts.length === 5 || parts.length === 6;
    }
}
exports.CronJobService = CronJobService;
