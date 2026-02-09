import { sqliteTable, text as sqliteText, integer as sqliteInteger } from 'drizzle-orm/sqlite-core';

export const conversations = sqliteTable('conversations', {
    id: sqliteInteger('id').primaryKey({ autoIncrement: true }),
    title: sqliteText('title').notNull(),
    createdAt: sqliteInteger('created_at').notNull().default(Date.now()),
    updatedAt: sqliteInteger('updated_at').notNull().default(Date.now()),
});

export const messages = sqliteTable('messages', {
    id: sqliteInteger('id').primaryKey({ autoIncrement: true }),
    conversationId: sqliteInteger('conversation_id').references(() => conversations.id),
    role: sqliteText('role').notNull(), // 'user' or 'assistant'
    content: sqliteText('content').notNull(),
    createdAt: sqliteInteger('created_at').notNull().default(Date.now()),
});

export const settings = sqliteTable('settings', {
    key: sqliteText('key').primaryKey(),
    value: sqliteText('value').notNull(),
    updatedAt: sqliteInteger('updated_at').notNull().default(Date.now()),
});

export const wallets = sqliteTable('wallets', {
    address: sqliteText('address').primaryKey(),
    chainType: sqliteText('chain_type').notNull().default('evm'), // 'evm' or 'solana'
    label: sqliteText('label'),
    addedAt: sqliteInteger('added_at').notNull().default(Date.now()),
});
