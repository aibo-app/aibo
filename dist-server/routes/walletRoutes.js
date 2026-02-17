"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = walletRoutes;
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const index_1 = require("../index");
const BackendTeamClient_1 = require("../services/BackendTeamClient");
async function walletRoutes(fastify) {
    // GET all wallets
    fastify.get('/api/wallets', async () => {
        return index_1.db.select().from(schema_1.wallets);
    });
    // POST add a new wallet
    fastify.post('/api/wallets', async (request, reply) => {
        const { address, label, chainType } = request.body;
        if (!address) {
            return reply.code(400).send({ error: 'Address is required' });
        }
        try {
            await index_1.db.insert(schema_1.wallets).values({
                address,
                chainType: chainType || 'evm',
                label: label || null,
                addedAt: Date.now(),
            });
            // Register for real-time tracking in backend-team
            BackendTeamClient_1.backendTeamClient.trackWallet(address, chainType || 'evm', label)
                .catch(e => console.error(`[WalletSync] Failed to register ${address} for tracking:`, e.message));
            return { success: true, address, chainType: chainType || 'evm' };
        }
        catch (err) {
            if (err && typeof err === 'object' && 'code' in err && err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
                return reply.code(409).send({ error: 'Wallet already exists' });
            }
            throw err;
        }
    });
    // DELETE a wallet
    fastify.delete('/api/wallets/:address', async (request) => {
        const { address } = request.params;
        await index_1.db.delete(schema_1.wallets).where((0, drizzle_orm_1.eq)(schema_1.wallets.address, address));
        return { success: true };
    });
}
