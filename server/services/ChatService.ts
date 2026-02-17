import { db } from '../index';
import { conversations, messages } from '../db/schema';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { OpenClawClient } from './OpenClawClient';
import { SettingsService } from './SettingsService';

export interface Message {
    id: number;
    conversationId: number | null;
    role: 'user' | 'assistant';
    content: string;
    metadata?: {
        toolCalls?: string[];
        skills?: string[];
        actions?: any[];
    };
    createdAt: number;
}

export interface Conversation {
    id: number;
    title: string;
    createdAt: number;
    updatedAt: number;
    lastMessage?: string;
}

export class ChatService {
    private static instance: ChatService;

    private constructor() {}

    public static getInstance(): ChatService {
        if (!ChatService.instance) {
            ChatService.instance = new ChatService();
        }
        return ChatService.instance;
    }

    /**
     * Get all conversations with last message preview
     */
    public async getConversations(): Promise<Conversation[]> {
        const convos = await db
            .select({
                id: conversations.id,
                title: conversations.title,
                createdAt: conversations.createdAt,
                updatedAt: conversations.updatedAt,
                lastMessage: sql<string>`(
                    SELECT SUBSTR(content, 1, 100)
                    FROM messages
                    WHERE messages.conversation_id = ${conversations.id}
                    ORDER BY messages.created_at DESC
                    LIMIT 1
                )`.as('last_message')
            })
            .from(conversations)
            .orderBy(desc(conversations.updatedAt))
            .all();

        return convos.map(c => ({
            id: c.id,
            title: c.title,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            lastMessage: c.lastMessage || undefined
        }));
    }

    /**
     * Get a specific conversation by ID
     */
    public async getConversation(id: number): Promise<Conversation | null> {
        const convo = await db.select().from(conversations).where(eq(conversations.id, id)).get();
        return convo || null;
    }

    /**
     * Get all messages for a conversation
     */
    public async getMessages(conversationId: number): Promise<Message[]> {
        const msgs = await db
            .select()
            .from(messages)
            .where(eq(messages.conversationId, conversationId))
            .orderBy(messages.createdAt)
            .all();

        return msgs.map(m => ({
            ...m,
            role: m.role as 'user' | 'assistant',
            metadata: m.metadata ? JSON.parse(m.metadata) : undefined
        }));
    }

    /**
     * Create a new conversation
     */
    public async createConversation(title?: string): Promise<Conversation> {
        const now = Date.now();
        const result = await db
            .insert(conversations)
            .values({
                title: title || 'New Conversation',
                createdAt: now,
                updatedAt: now
            })
            .returning();

        return result[0];
    }

    /**
     * Get today's conversation or create one. Used by popup and voice endpoints
     * so messages persist to ChatPage. Rotates every 24 hours (calendar day).
     */
    public async getOrCreateDailyConversation(): Promise<Conversation> {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        // Look for a conversation created today
        const existing = await db
            .select()
            .from(conversations)
            .where(gte(conversations.createdAt, startOfDay))
            .orderBy(desc(conversations.createdAt))
            .limit(1)
            .all();

        if (existing.length > 0) {
            return existing[0];
        }

        // Create a new conversation titled with today's date
        const title = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return this.createConversation(title);
    }

    /**
     * Update conversation title or timestamp
     */
    public async updateConversation(id: number, updates: { title?: string }): Promise<void> {
        await db
            .update(conversations)
            .set({ ...updates, updatedAt: Date.now() })
            .where(eq(conversations.id, id));
    }

    /**
     * Delete a conversation and all its messages
     */
    public async deleteConversation(id: number): Promise<void> {
        await db.delete(messages).where(eq(messages.conversationId, id));
        await db.delete(conversations).where(eq(conversations.id, id));
    }

    /**
     * Send a message and get OpenClaw Brain response
     */
    public async sendMessage(
        conversationId: number,
        userMessage: string,
        brainMessage?: string
    ): Promise<{ userMsg: Message; assistantMsg: Message }> {
        const now = Date.now();

        // Save user message
        const userMsgResult = await db
            .insert(messages)
            .values({
                conversationId,
                role: 'user',
                content: userMessage,
                createdAt: now
            })
            .returning();

        const userMsg = userMsgResult[0];

        // Fetch recent conversation history with configurable window size
        const settingsService = SettingsService.getInstance();
        const windowSize = (await settingsService.getNumber('CHAT_HISTORY_WINDOW_SIZE')) || 10;
        const maxTokens = (await settingsService.getNumber('CHAT_MAX_TOKENS')) || 4000;
        const enableTrimming = await settingsService.getBoolean('CHAT_ENABLE_SUMMARIZATION');

        const recentMessages = await db
            .select()
            .from(messages)
            .where(eq(messages.conversationId, conversationId))
            .orderBy(desc(messages.createdAt))
            .limit(windowSize)
            .all();

        let history = recentMessages.reverse().map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
        }));

        // Trim oldest messages if over token budget (rough estimate: ~4 chars per token)
        if (enableTrimming) {
            const estimateTokens = (msgs: typeof history) =>
                msgs.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);

            while (estimateTokens(history) > maxTokens && history.length > 3) {
                history.shift();
            }
        }

        // Get response from OpenClaw Brain with conversation context
        // brainMessage allows voice endpoint to add brevity hints without polluting chat history
        const openClawClient = OpenClawClient.getInstance();
        const response = await openClawClient.sendMessage(brainMessage || userMessage);

        // Track any tool calls or skills used (extract from response if available)
        const metadata = this.extractMetadata(response);

        // Save assistant message
        const assistantMsgResult = await db
            .insert(messages)
            .values({
                conversationId,
                role: 'assistant',
                content: response,
                metadata: metadata ? JSON.stringify(metadata) : null,
                createdAt: Date.now()
            })
            .returning();

        // Update conversation timestamp
        await this.updateConversation(conversationId, {});

        // Auto-generate title from first exchange if still "New Conversation"
        const convo = await this.getConversation(conversationId);
        if (convo && convo.title === 'New Conversation') {
            const title = this.generateTitle(userMessage);
            await this.updateConversation(conversationId, { title });
        }

        return {
            userMsg: {
                ...userMsg,
                role: userMsg.role as 'user' | 'assistant',
                metadata: userMsg.metadata ? JSON.parse(userMsg.metadata) : undefined
            },
            assistantMsg: {
                ...assistantMsgResult[0],
                role: assistantMsgResult[0].role as 'user' | 'assistant',
                metadata: metadata || undefined
            }
        };
    }

    /**
     * Extract metadata from response (tool calls, skills used, etc.)
     * This is a simple implementation - could be enhanced with OpenClaw event tracking
     */
    private extractMetadata(response: string): { toolCalls?: string[]; skills?: string[] } | null {
        // Look for common patterns in responses that indicate tool/skill usage
        const metadata: { toolCalls?: string[]; skills?: string[] } = {};

        // Check for portfolio skill usage
        if (response.includes('portfolio') || response.includes('Portfolio')) {
            metadata.skills = metadata.skills || [];
            metadata.skills.push('portfolio');
        }

        // Check for wallet operations
        if (response.includes('wallet') || response.includes('Wallet')) {
            metadata.toolCalls = metadata.toolCalls || [];
            metadata.toolCalls.push('wallet operations');
        }

        return Object.keys(metadata).length > 0 ? metadata : null;
    }

    /**
     * Generate a conversation title from first user message
     */
    private generateTitle(firstMessage: string): string {
        // Take first 50 chars or up to first question mark/period
        const cleaned = firstMessage.trim();
        const cutoff = Math.min(
            cleaned.indexOf('?') > 0 ? cleaned.indexOf('?') : 50,
            cleaned.indexOf('.') > 0 ? cleaned.indexOf('.') : 50,
            50
        );

        let title = cleaned.substring(0, cutoff);
        if (cleaned.length > cutoff) title += '...';

        return title || 'New Conversation';
    }
}
