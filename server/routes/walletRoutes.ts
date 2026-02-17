import { FastifyInstance } from 'fastify';
import { wallets } from '../db/schema';
import { eq } from 'drizzle-orm';
import { db } from '../index';
import { backendTeamClient } from '../services/BackendTeamClient';

export default async function walletRoutes(fastify: FastifyInstance) {
    // GET all wallets
    fastify.get('/api/wallets', async () => {
        return db.select().from(wallets);
    });

    // POST add a new wallet
    fastify.post('/api/wallets', async (request, reply) => {
        const { address, label, chainType } = request.body as { address: string; label?: string; chainType?: string };

        if (!address) {
            return reply.code(400).send({ error: 'Address is required' });
        }

        try {
            await db.insert(wallets).values({
                address,
                chainType: (chainType as 'evm' | 'solana') || 'evm',
                label: label || null,
                addedAt: Date.now(),
            });

            // Register for real-time tracking in backend-team
            backendTeamClient.trackWallet(address, chainType || 'evm', label)
                .catch(e => console.error(`[WalletSync] Failed to register ${address} for tracking:`, e.message));

            return { success: true, address, chainType: chainType || 'evm' };
        } catch (err: unknown) {
            if (err && typeof err === 'object' && 'code' in err && err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
                return reply.code(409).send({ error: 'Wallet already exists' });
            }
            throw err;
        }
    });

    // DELETE a wallet
    fastify.delete('/api/wallets/:address', async (request) => {
        const { address } = request.params as { address: string };

        await db.delete(wallets).where(eq(wallets.address, address));
        return { success: true };
    });
}
