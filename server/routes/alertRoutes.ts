import { FastifyPluginAsync } from 'fastify';
import { AlertService } from '../services/AlertService';

const alertRoutes: FastifyPluginAsync = async (fastify) => {
    // Get recent alerts
    fastify.get('/api/alerts', async (request: any, reply) => {
        const { limit = '20' } = request.query;
        const parsedLimit = parseInt(limit) || 20;
        const alerts = await AlertService.getFormattedAlerts(parsedLimit);
        return { alerts };
    });

    // Get unread alert count (lightweight, for badge)
    fastify.get('/api/alerts/unread-count', async () => {
        const count = await AlertService.getUnreadCount();
        return { count };
    });

    // Mark alert as read
    fastify.post('/api/alerts/:id/read', async (request: any, reply) => {
        const { id } = request.params;
        const parsedId = parseInt(id);
        if (isNaN(parsedId)) return reply.code(400).send({ error: 'Invalid alert ID' });
        await AlertService.markAsRead(parsedId);
        return { success: true };
    });

    // Mark all alerts as read
    fastify.post('/api/alerts/read-all', async () => {
        await AlertService.markAllAsRead();
        return { success: true };
    });

    // Manually trigger alert checks (for testing/debugging)
    fastify.post('/api/alerts/check', async () => {
        await AlertService.checkPriceAlerts();
        await AlertService.checkGasAlerts();
        await AlertService.checkTransferAlerts();
        return { success: true, message: 'Alert checks triggered' };
    });
};

export default alertRoutes;
