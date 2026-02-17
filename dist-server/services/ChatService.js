"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const index_1 = require("../index");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const OpenClawClient_1 = require("./OpenClawClient");
const SettingsService_1 = require("./SettingsService");
class ChatService {
    static instance;
    constructor() { }
    static getInstance() {
        if (!ChatService.instance) {
            ChatService.instance = new ChatService();
        }
        return ChatService.instance;
    }
    /**
     * Get all conversations with last message preview
     */
    async getConversations() {
        const convos = await index_1.db
            .select({
            id: schema_1.conversations.id,
            title: schema_1.conversations.title,
            createdAt: schema_1.conversations.createdAt,
            updatedAt: schema_1.conversations.updatedAt,
            lastMessage: (0, drizzle_orm_1.sql) `(
                    SELECT SUBSTR(content, 1, 100)
                    FROM messages
                    WHERE messages.conversation_id = ${schema_1.conversations.id}
                    ORDER BY messages.created_at DESC
                    LIMIT 1
                )`.as('last_message')
        })
            .from(schema_1.conversations)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.conversations.updatedAt))
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
    async getConversation(id) {
        const convo = await index_1.db.select().from(schema_1.conversations).where((0, drizzle_orm_1.eq)(schema_1.conversations.id, id)).get();
        return convo || null;
    }
    /**
     * Get all messages for a conversation
     */
    async getMessages(conversationId) {
        const msgs = await index_1.db
            .select()
            .from(schema_1.messages)
            .where((0, drizzle_orm_1.eq)(schema_1.messages.conversationId, conversationId))
            .orderBy(schema_1.messages.createdAt)
            .all();
        return msgs.map(m => ({
            ...m,
            role: m.role,
            metadata: m.metadata ? JSON.parse(m.metadata) : undefined
        }));
    }
    /**
     * Create a new conversation
     */
    async createConversation(title) {
        const now = Date.now();
        const result = await index_1.db
            .insert(schema_1.conversations)
            .values({
            title: title || 'New Conversation',
            createdAt: now,
            updatedAt: now
        })
            .returning();
        return result[0];
    }
    /**
     * Update conversation title or timestamp
     */
    async updateConversation(id, updates) {
        await index_1.db
            .update(schema_1.conversations)
            .set({ ...updates, updatedAt: Date.now() })
            .where((0, drizzle_orm_1.eq)(schema_1.conversations.id, id));
    }
    /**
     * Delete a conversation and all its messages
     */
    async deleteConversation(id) {
        await index_1.db.delete(schema_1.messages).where((0, drizzle_orm_1.eq)(schema_1.messages.conversationId, id));
        await index_1.db.delete(schema_1.conversations).where((0, drizzle_orm_1.eq)(schema_1.conversations.id, id));
    }
    /**
     * Send a message and get OpenClaw Brain response
     */
    async sendMessage(conversationId, userMessage) {
        const now = Date.now();
        // Save user message
        const userMsgResult = await index_1.db
            .insert(schema_1.messages)
            .values({
            conversationId,
            role: 'user',
            content: userMessage,
            createdAt: now
        })
            .returning();
        const userMsg = userMsgResult[0];
        // Fetch recent conversation history with configurable window size
        const settingsService = SettingsService_1.SettingsService.getInstance();
        const windowSize = (await settingsService.getNumber('CHAT_HISTORY_WINDOW_SIZE')) || 10;
        const maxTokens = (await settingsService.getNumber('CHAT_MAX_TOKENS')) || 4000;
        const enableTrimming = await settingsService.getBoolean('CHAT_ENABLE_SUMMARIZATION');
        const recentMessages = await index_1.db
            .select()
            .from(schema_1.messages)
            .where((0, drizzle_orm_1.eq)(schema_1.messages.conversationId, conversationId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.messages.createdAt))
            .limit(windowSize)
            .all();
        let history = recentMessages.reverse().map(m => ({
            role: m.role,
            content: m.content
        }));
        // Trim oldest messages if over token budget (rough estimate: ~4 chars per token)
        if (enableTrimming) {
            const estimateTokens = (msgs) => msgs.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
            while (estimateTokens(history) > maxTokens && history.length > 3) {
                history.shift();
            }
        }
        // Get response from OpenClaw Brain with conversation context
        const openClawClient = OpenClawClient_1.OpenClawClient.getInstance();
        const response = await openClawClient.sendMessage(userMessage);
        // Track any tool calls or skills used (extract from response if available)
        const metadata = this.extractMetadata(response);
        // Save assistant message
        const assistantMsgResult = await index_1.db
            .insert(schema_1.messages)
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
                role: userMsg.role,
                metadata: userMsg.metadata ? JSON.parse(userMsg.metadata) : undefined
            },
            assistantMsg: {
                ...assistantMsgResult[0],
                role: assistantMsgResult[0].role,
                metadata: metadata || undefined
            }
        };
    }
    /**
     * Extract metadata from response (tool calls, skills used, etc.)
     * This is a simple implementation - could be enhanced with OpenClaw event tracking
     */
    extractMetadata(response) {
        // Look for common patterns in responses that indicate tool/skill usage
        const metadata = {};
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
    generateTitle(firstMessage) {
        // Take first 50 chars or up to first question mark/period
        const cleaned = firstMessage.trim();
        const cutoff = Math.min(cleaned.indexOf('?') > 0 ? cleaned.indexOf('?') : 50, cleaned.indexOf('.') > 0 ? cleaned.indexOf('.') : 50, 50);
        let title = cleaned.substring(0, cutoff);
        if (cleaned.length > cutoff)
            title += '...';
        return title || 'New Conversation';
    }
}
exports.ChatService = ChatService;
