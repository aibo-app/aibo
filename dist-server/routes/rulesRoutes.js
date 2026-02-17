"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = rulesRoutes;
const RulesService_1 = require("../services/RulesService");
const BrainManager_1 = require("../services/BrainManager");
async function rulesRoutes(fastify) {
    const rulesService = RulesService_1.RulesService.getInstance();
    // List all rules with their artifacts
    fastify.get('/api/rules', async () => {
        const rules = await rulesService.listRules();
        return { rules };
    });
    // Create a new rule + async compile
    fastify.post('/api/rules', async (request, reply) => {
        const { text } = request.body;
        if (!text || typeof text !== 'string' || !text.trim()) {
            return reply.code(400).send({ error: 'text is required.' });
        }
        if (text.length > 2000) {
            return reply.code(400).send({ error: 'Rule text must be under 2000 characters.' });
        }
        const rule = await rulesService.createRule(text.trim());
        // Compile async — don't block the response
        rulesService.compileRule(rule.id).then(async () => {
            // Trigger hot-reload so SOUL.md picks up the new rule
            try {
                await BrainManager_1.BrainManager.getInstance().reload();
            }
            catch { }
        }).catch(err => {
            console.error(`[Rules] Compilation failed for rule ${rule.id}:`, err);
        });
        return reply.code(201).send({ rule: { ...rule, artifacts: [] } });
    });
    // Update a rule's text + recompile
    fastify.put('/api/rules/:id', async (request, reply) => {
        const id = parseInt(request.params.id, 10);
        if (isNaN(id))
            return reply.code(400).send({ error: 'Invalid rule ID.' });
        const { text } = request.body;
        if (!text || typeof text !== 'string' || !text.trim()) {
            return reply.code(400).send({ error: 'text is required.' });
        }
        if (text.length > 2000) {
            return reply.code(400).send({ error: 'Rule text must be under 2000 characters.' });
        }
        const rule = await rulesService.updateRule(id, text.trim());
        if (!rule)
            return reply.code(404).send({ error: 'Rule not found.' });
        // Recompile async
        rulesService.compileRule(id).then(async () => {
            try {
                await BrainManager_1.BrainManager.getInstance().reload();
            }
            catch { }
        }).catch(err => {
            console.error(`[Rules] Recompilation failed for rule ${id}:`, err);
        });
        return { rule };
    });
    // Delete a rule + cleanup
    fastify.delete('/api/rules/:id', async (request, reply) => {
        const id = parseInt(request.params.id, 10);
        if (isNaN(id))
            return reply.code(400).send({ error: 'Invalid rule ID.' });
        const deleted = await rulesService.deleteRule(id);
        if (!deleted)
            return reply.code(404).send({ error: 'Rule not found.' });
        // Reload brain to update SOUL.md
        try {
            await BrainManager_1.BrainManager.getInstance().reload();
        }
        catch { }
        return { success: true };
    });
    // Manual recompile
    fastify.post('/api/rules/:id/compile', async (request, reply) => {
        const id = parseInt(request.params.id, 10);
        if (isNaN(id))
            return reply.code(400).send({ error: 'Invalid rule ID.' });
        const artifact = await rulesService.compileRule(id);
        if (!artifact)
            return reply.code(404).send({ error: 'Rule not found.' });
        // Reload brain with updated artifacts
        try {
            await BrainManager_1.BrainManager.getInstance().reload();
        }
        catch { }
        return { artifact };
    });
}
