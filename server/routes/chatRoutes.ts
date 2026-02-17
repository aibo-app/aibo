import { FastifyInstance } from 'fastify';
import { ChatService } from '../services/ChatService';

export default async function chatRoutes(fastify: FastifyInstance) {
    const chatService = ChatService.getInstance();

    // Get all conversations
    fastify.get('/api/chat/conversations', async () => {
        const conversations = await chatService.getConversations();
        return { conversations };
    });

    // Get messages for a conversation
    fastify.get<{ Params: { id: string } }>('/api/chat/:id/messages', async (request, reply) => {
        const conversationId = parseInt(request.params.id);
        if (isNaN(conversationId)) return reply.code(400).send({ error: 'Invalid conversation ID' });
        const messages = await chatService.getMessages(conversationId);
        return { messages };
    });

    // Create new conversation
    fastify.post<{ Body: { title?: string } }>('/api/chat/new', async (request) => {
        const { title } = request.body || {};
        const conversation = await chatService.createConversation(title);
        return { conversation };
    });

    // Send message in a conversation
    fastify.post<{
        Params: { id: string };
        Body: { message: string };
    }>('/api/chat/:id/message', async (request, reply) => {
        const conversationId = parseInt(request.params.id);
        if (isNaN(conversationId)) return reply.code(400).send({ error: 'Invalid conversation ID' });
        const { message } = request.body;

        if (!message || !message.trim()) {
            return reply.code(400).send({ error: 'Message is required' });
        }

        try {
            const result = await chatService.sendMessage(conversationId, message.trim());
            return result;
        } catch (error: any) {
            console.error('[ChatRoutes] Send message failed:', error);
            return reply.code(500).send({ error: error.message || 'Failed to send message' });
        }
    });

    // Update conversation (e.g., change title)
    fastify.patch<{
        Params: { id: string };
        Body: { title?: string };
    }>('/api/chat/:id', async (request, reply) => {
        const conversationId = parseInt(request.params.id);
        if (isNaN(conversationId)) return reply.code(400).send({ error: 'Invalid conversation ID' });
        const { title } = request.body;

        await chatService.updateConversation(conversationId, { title });
        return { success: true };
    });

    // Delete conversation
    fastify.delete<{ Params: { id: string } }>('/api/chat/:id', async (request, reply) => {
        const conversationId = parseInt(request.params.id);
        if (isNaN(conversationId)) return reply.code(400).send({ error: 'Invalid conversation ID' });
        await chatService.deleteConversation(conversationId);
        return { success: true };
    });
}
