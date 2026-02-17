import { SettingsService } from './SettingsService';
import { OpenClawConfigService } from './OpenClawConfigService';
import type { CronJobConfig } from '../types/settings';

/**
 * CronJobService - Manages proactive monitoring cron jobs
 *
 * Allows creating, updating, and deleting scheduled tasks that
 * OpenClaw will execute on a schedule (portfolio checks, alerts, etc.)
 */
export class CronJobService {
    private static instance: CronJobService;

    private constructor() {}

    public static getInstance(): CronJobService {
        if (!CronJobService.instance) {
            CronJobService.instance = new CronJobService();
        }
        return CronJobService.instance;
    }

    /**
     * Get all configured cron jobs
     */
    public async getCronJobs(): Promise<CronJobConfig[]> {
        const settingsService = SettingsService.getInstance();
        return await settingsService.getJSON<CronJobConfig[]>('OPENCLAW_CRON_JOBS') || [];
    }

    /**
     * Save or update a cron job
     */
    public async saveCronJob(job: CronJobConfig): Promise<void> {
        const jobs = await this.getCronJobs();
        const index = jobs.findIndex(j => j.id === job.id);

        if (index >= 0) {
            jobs[index] = job;
        } else {
            jobs.push(job);
        }

        const settingsService = SettingsService.getInstance();
        await settingsService.setJSON('OPENCLAW_CRON_JOBS', jobs);
        await OpenClawConfigService.getInstance().generateConfig();
    }

    /**
     * Delete a cron job by ID
     */
    public async deleteCronJob(id: string): Promise<void> {
        const jobs = await this.getCronJobs();
        const filtered = jobs.filter(j => j.id !== id);

        const settingsService = SettingsService.getInstance();
        await settingsService.setJSON('OPENCLAW_CRON_JOBS', filtered);
        await OpenClawConfigService.getInstance().generateConfig();
    }

    /**
     * Toggle a cron job's enabled state
     */
    public async toggleCronJob(id: string, enabled: boolean): Promise<void> {
        const jobs = await this.getCronJobs();
        const job = jobs.find(j => j.id === id);
        if (job) {
            job.enabled = enabled;
            const settingsService = SettingsService.getInstance();
            await settingsService.setJSON('OPENCLAW_CRON_JOBS', jobs);
            await OpenClawConfigService.getInstance().generateConfig();
        }
    }

    /**
     * Validate a cron expression (basic check)
     */
    public validateCronExpression(expr: string): boolean {
        const parts = expr.trim().split(/\s+/);
        return parts.length === 5 || parts.length === 6;
    }
}
