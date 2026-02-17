import { FastifyInstance } from 'fastify';
import { CronJobService } from '../services/CronJobService';
import type { CronJobConfig } from '../types/settings';

const VALID_ACTIONS = new Set(['portfolio_summary', 'price_alert', 'custom_query']);
const MAX_CRON_JOBS = 50;
const MAX_ID_LENGTH = 64;
const MAX_NAME_LENGTH = 128;

export default async function cronRoutes(fastify: FastifyInstance) {
    const cronService = CronJobService.getInstance();

    // Get all cron jobs
    fastify.get('/api/cron/jobs', async () => {
        const jobs = await cronService.getCronJobs();
        return { jobs };
    });

    // Create or update a cron job
    fastify.post<{ Body: CronJobConfig }>('/api/cron/jobs', async (request, reply) => {
        const job = request.body;

        if (!job || !job.id || !job.name) {
            return reply.code(400).send({ error: 'Job must have id and name.' });
        }
        if (typeof job.id !== 'string' || job.id.length > MAX_ID_LENGTH) {
            return reply.code(400).send({ error: `Job ID must be a string (max ${MAX_ID_LENGTH} chars).` });
        }
        if (typeof job.name !== 'string' || job.name.length > MAX_NAME_LENGTH) {
            return reply.code(400).send({ error: `Job name must be a string (max ${MAX_NAME_LENGTH} chars).` });
        }
        if (!job.schedule || !job.schedule.kind) {
            return reply.code(400).send({ error: 'Job must have a schedule.' });
        }
        if (!job.action || !VALID_ACTIONS.has(job.action)) {
            return reply.code(400).send({ error: `Invalid action. Must be one of: ${[...VALID_ACTIONS].join(', ')}` });
        }

        // Validate schedule
        if (job.schedule.kind === 'cron' && job.schedule.expr) {
            if (!cronService.validateCronExpression(job.schedule.expr)) {
                return reply.code(400).send({ error: 'Invalid cron expression.' });
            }
        }
        if (job.schedule.kind === 'every' && (!job.schedule.everyMs || job.schedule.everyMs < 60000)) {
            return reply.code(400).send({ error: 'Interval must be at least 60 seconds.' });
        }

        // Enforce max job count (only for new jobs, not updates)
        const existingJobs = await cronService.getCronJobs();
        const isUpdate = existingJobs.some(j => j.id === job.id);
        if (!isUpdate && existingJobs.length >= MAX_CRON_JOBS) {
            return reply.code(400).send({ error: `Maximum ${MAX_CRON_JOBS} cron jobs allowed.` });
        }

        await cronService.saveCronJob(job);
        return { success: true };
    });

    // Toggle a cron job
    fastify.post<{
        Params: { id: string };
        Body: { enabled: boolean };
    }>('/api/cron/jobs/:id/toggle', async (request, reply) => {
        const { id } = request.params;
        const { enabled } = request.body;

        if (typeof enabled !== 'boolean') {
            return reply.code(400).send({ error: 'enabled must be a boolean.' });
        }

        await cronService.toggleCronJob(id, enabled);
        return { success: true };
    });

    // Delete a cron job
    fastify.delete<{ Params: { id: string } }>('/api/cron/jobs/:id', async (request, reply) => {
        const { id } = request.params;
        if (!id) {
            return reply.code(400).send({ error: 'Job ID is required.' });
        }

        await cronService.deleteCronJob(id);
        return { success: true };
    });
}
