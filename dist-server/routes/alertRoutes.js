"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AlertService_1 = require("../services/AlertService");
const alertRoutes = async (fastify) => {
    // Get recent alerts
    fastify.get('/api/alerts', async (request, reply) => {
        const { limit = '20' } = request.query;
        const parsedLimit = parseInt(limit) || 20;
        const alerts = await AlertService_1.AlertService.getFormattedAlerts(parsedLimit);
        return { alerts };
    });
    // Get unread alert count (lightweight, for badge)
    fastify.get('/api/alerts/unread-count', async () => {
        const count = await AlertService_1.AlertService.getUnreadCount();
        return { count };
    });
    // Mark alert as read
    fastify.post('/api/alerts/:id/read', async (request, reply) => {
        const { id } = request.params;
        const parsedId = parseInt(id);
        if (isNaN(parsedId))
            return reply.code(400).send({ error: 'Invalid alert ID' });
        await AlertService_1.AlertService.markAsRead(parsedId);
        return { success: true };
    });
    // Mark all alerts as read
    fastify.post('/api/alerts/read-all', async () => {
        await AlertService_1.AlertService.markAllAsRead();
        return { success: true };
    });
    // Manually trigger alert checks (for testing/debugging)
    fastify.post('/api/alerts/check', async () => {
        await AlertService_1.AlertService.checkPriceAlerts();
        await AlertService_1.AlertService.checkGasAlerts();
        await AlertService_1.AlertService.checkTransferAlerts();
        return { success: true, message: 'Alert checks triggered' };
    });
};
exports.default = alertRoutes;
