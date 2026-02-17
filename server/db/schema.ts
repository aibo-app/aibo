import { sqliteTable, text as sqliteText, integer as sqliteInteger } from 'drizzle-orm/sqlite-core';

export const conversations = sqliteTable('conversations', {
    id: sqliteInteger('id').primaryKey({ autoIncrement: true }),
    title: sqliteText('title').notNull(),
    createdAt: sqliteInteger('created_at').notNull().$defaultFn(() => Date.now()),
    updatedAt: sqliteInteger('updated_at').notNull().$defaultFn(() => Date.now()),
});

export const messages = sqliteTable('messages', {
    id: sqliteInteger('id').primaryKey({ autoIncrement: true }),
    conversationId: sqliteInteger('conversation_id').references(() => conversations.id),
    role: sqliteText('role').notNull(), // 'user' or 'assistant'
    content: sqliteText('content').notNull(),
    metadata: sqliteText('metadata'), // JSON: { toolCalls: [], skills: [], actions: [] }
    createdAt: sqliteInteger('created_at').notNull().$defaultFn(() => Date.now()),
});

export const settings = sqliteTable('settings', {
    key: sqliteText('key').primaryKey(),
    value: sqliteText('value').notNull(),
    updatedAt: sqliteInteger('updated_at').notNull().$defaultFn(() => Date.now()),
});

export const wallets = sqliteTable('wallets', {
    address: sqliteText('address').primaryKey(),
    chainType: sqliteText('chain_type').notNull().default('evm'), // 'evm' or 'solana'
    label: sqliteText('label'),
    addedAt: sqliteInteger('added_at').notNull().$defaultFn(() => Date.now()),
});

// Portfolio snapshots for historical tracking
export const portfolioSnapshots = sqliteTable('portfolio_snapshots', {
    id: sqliteInteger('id').primaryKey({ autoIncrement: true }),
    totalValue: sqliteText('total_value').notNull(), // Store as string to avoid precision loss
    totalChange24h: sqliteText('total_change_24h').notNull(),
    assetsJson: sqliteText('assets_json').notNull(), // JSON string of all assets
    timestamp: sqliteInteger('timestamp').notNull(),
    createdAt: sqliteInteger('created_at').notNull().$defaultFn(() => Date.now()),
});

// Individual asset history for charting
export const assetHistory = sqliteTable('asset_history', {
    id: sqliteInteger('id').primaryKey({ autoIncrement: true }),
    symbol: sqliteText('symbol').notNull(),
    chain: sqliteText('chain').notNull(), // 'EVM' or 'SOLANA'
    balance: sqliteText('balance').notNull(),
    value: sqliteText('value').notNull(),
    price: sqliteText('price').notNull(),
    timestamp: sqliteInteger('timestamp').notNull(),
    createdAt: sqliteInteger('created_at').notNull().$defaultFn(() => Date.now()),
});

// Real-time alerts and notifications
export const alerts = sqliteTable('alerts', {
    id: sqliteInteger('id').primaryKey({ autoIncrement: true }),
    type: sqliteText('type').notNull(), // 'price_change', 'large_transfer', 'security', etc.
    severity: sqliteText('severity').notNull(), // 'info', 'warning', 'critical'
    title: sqliteText('title').notNull(),
    description: sqliteText('description').notNull(),
    metadata: sqliteText('metadata'), // JSON string for additional data
    isRead: sqliteInteger('is_read').notNull().default(0), // 0 = unread, 1 = read
    createdAt: sqliteInteger('created_at').notNull().$defaultFn(() => Date.now()),
});
// Natural language rules with compiled artifacts
export const rules = sqliteTable('rules', {
    id: sqliteInteger('id').primaryKey({ autoIncrement: true }),
    text: sqliteText('text').notNull(),
    createdAt: sqliteInteger('created_at').notNull().$defaultFn(() => Date.now()),
    updatedAt: sqliteInteger('updated_at').notNull().$defaultFn(() => Date.now()),
});

export const ruleArtifacts = sqliteTable('rule_artifacts', {
    id: sqliteInteger('id').primaryKey({ autoIncrement: true }),
    ruleId: sqliteInteger('rule_id').notNull().references(() => rules.id),
    type: sqliteText('type').notNull(), // 'policy-fragment' | 'guard' | 'action-bundle'
    content: sqliteText('content').notNull(),
    outputPath: sqliteText('output_path'),
    status: sqliteText('status').notNull().default('pending'), // 'ok' | 'failed' | 'pending'
    compiledAt: sqliteInteger('compiled_at'),
});

// Local cache for transactions to ensure instant loading on page start
export const transactions = sqliteTable('transactions', {
    signature: sqliteText('signature').primaryKey(),
    walletAddress: sqliteText('wallet_address').notNull(),
    chain: sqliteText('chain').notNull(),
    type: sqliteText('type').notNull(),
    symbol: sqliteText('symbol').notNull(),
    amount: sqliteText('amount').notNull(),
    timestamp: sqliteInteger('timestamp').notNull(),
    status: sqliteText('status').notNull(),
    label: sqliteText('label'),
    rawData: sqliteText('raw_data'), // JSON string of the full transaction
    createdAt: sqliteInteger('created_at').notNull().$defaultFn(() => Date.now()),
});
