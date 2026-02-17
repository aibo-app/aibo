"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactions = exports.ruleArtifacts = exports.rules = exports.alerts = exports.assetHistory = exports.portfolioSnapshots = exports.wallets = exports.settings = exports.messages = exports.conversations = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.conversations = (0, sqlite_core_1.sqliteTable)('conversations', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    title: (0, sqlite_core_1.text)('title').notNull(),
    createdAt: (0, sqlite_core_1.integer)('created_at').notNull().$defaultFn(() => Date.now()),
    updatedAt: (0, sqlite_core_1.integer)('updated_at').notNull().$defaultFn(() => Date.now()),
});
exports.messages = (0, sqlite_core_1.sqliteTable)('messages', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    conversationId: (0, sqlite_core_1.integer)('conversation_id').references(() => exports.conversations.id),
    role: (0, sqlite_core_1.text)('role').notNull(), // 'user' or 'assistant'
    content: (0, sqlite_core_1.text)('content').notNull(),
    metadata: (0, sqlite_core_1.text)('metadata'), // JSON: { toolCalls: [], skills: [], actions: [] }
    createdAt: (0, sqlite_core_1.integer)('created_at').notNull().$defaultFn(() => Date.now()),
});
exports.settings = (0, sqlite_core_1.sqliteTable)('settings', {
    key: (0, sqlite_core_1.text)('key').primaryKey(),
    value: (0, sqlite_core_1.text)('value').notNull(),
    updatedAt: (0, sqlite_core_1.integer)('updated_at').notNull().$defaultFn(() => Date.now()),
});
exports.wallets = (0, sqlite_core_1.sqliteTable)('wallets', {
    address: (0, sqlite_core_1.text)('address').primaryKey(),
    chainType: (0, sqlite_core_1.text)('chain_type').notNull().default('evm'), // 'evm' or 'solana'
    label: (0, sqlite_core_1.text)('label'),
    addedAt: (0, sqlite_core_1.integer)('added_at').notNull().$defaultFn(() => Date.now()),
});
// Portfolio snapshots for historical tracking
exports.portfolioSnapshots = (0, sqlite_core_1.sqliteTable)('portfolio_snapshots', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    totalValue: (0, sqlite_core_1.text)('total_value').notNull(), // Store as string to avoid precision loss
    totalChange24h: (0, sqlite_core_1.text)('total_change_24h').notNull(),
    assetsJson: (0, sqlite_core_1.text)('assets_json').notNull(), // JSON string of all assets
    timestamp: (0, sqlite_core_1.integer)('timestamp').notNull(),
    createdAt: (0, sqlite_core_1.integer)('created_at').notNull().$defaultFn(() => Date.now()),
});
// Individual asset history for charting
exports.assetHistory = (0, sqlite_core_1.sqliteTable)('asset_history', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    symbol: (0, sqlite_core_1.text)('symbol').notNull(),
    chain: (0, sqlite_core_1.text)('chain').notNull(), // 'EVM' or 'SOLANA'
    balance: (0, sqlite_core_1.text)('balance').notNull(),
    value: (0, sqlite_core_1.text)('value').notNull(),
    price: (0, sqlite_core_1.text)('price').notNull(),
    timestamp: (0, sqlite_core_1.integer)('timestamp').notNull(),
    createdAt: (0, sqlite_core_1.integer)('created_at').notNull().$defaultFn(() => Date.now()),
});
// Real-time alerts and notifications
exports.alerts = (0, sqlite_core_1.sqliteTable)('alerts', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    type: (0, sqlite_core_1.text)('type').notNull(), // 'price_change', 'large_transfer', 'security', etc.
    severity: (0, sqlite_core_1.text)('severity').notNull(), // 'info', 'warning', 'critical'
    title: (0, sqlite_core_1.text)('title').notNull(),
    description: (0, sqlite_core_1.text)('description').notNull(),
    metadata: (0, sqlite_core_1.text)('metadata'), // JSON string for additional data
    isRead: (0, sqlite_core_1.integer)('is_read').notNull().default(0), // 0 = unread, 1 = read
    createdAt: (0, sqlite_core_1.integer)('created_at').notNull().$defaultFn(() => Date.now()),
});
// Natural language rules with compiled artifacts
exports.rules = (0, sqlite_core_1.sqliteTable)('rules', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    text: (0, sqlite_core_1.text)('text').notNull(),
    createdAt: (0, sqlite_core_1.integer)('created_at').notNull().$defaultFn(() => Date.now()),
    updatedAt: (0, sqlite_core_1.integer)('updated_at').notNull().$defaultFn(() => Date.now()),
});
exports.ruleArtifacts = (0, sqlite_core_1.sqliteTable)('rule_artifacts', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    ruleId: (0, sqlite_core_1.integer)('rule_id').notNull().references(() => exports.rules.id),
    type: (0, sqlite_core_1.text)('type').notNull(), // 'policy-fragment' | 'guard' | 'action-bundle'
    content: (0, sqlite_core_1.text)('content').notNull(),
    outputPath: (0, sqlite_core_1.text)('output_path'),
    status: (0, sqlite_core_1.text)('status').notNull().default('pending'), // 'ok' | 'failed' | 'pending'
    compiledAt: (0, sqlite_core_1.integer)('compiled_at'),
});
// Local cache for transactions to ensure instant loading on page start
exports.transactions = (0, sqlite_core_1.sqliteTable)('transactions', {
    signature: (0, sqlite_core_1.text)('signature').primaryKey(),
    walletAddress: (0, sqlite_core_1.text)('wallet_address').notNull(),
    chain: (0, sqlite_core_1.text)('chain').notNull(),
    type: (0, sqlite_core_1.text)('type').notNull(),
    symbol: (0, sqlite_core_1.text)('symbol').notNull(),
    amount: (0, sqlite_core_1.text)('amount').notNull(),
    timestamp: (0, sqlite_core_1.integer)('timestamp').notNull(),
    status: (0, sqlite_core_1.text)('status').notNull(),
    label: (0, sqlite_core_1.text)('label'),
    rawData: (0, sqlite_core_1.text)('raw_data'), // JSON string of the full transaction
    createdAt: (0, sqlite_core_1.integer)('created_at').notNull().$defaultFn(() => Date.now()),
});
