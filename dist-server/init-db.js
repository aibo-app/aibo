"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const BetterSqlite3 = __importStar(require("better-sqlite3"));
const Database = BetterSqlite3.default || BetterSqlite3;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const DB_PATH = path.join(__dirname, '../data/aibo.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
const db = new Database(DB_PATH);
console.log('Initializing database at:', DB_PATH);
db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER REFERENCES conversations(id),
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS wallets (
        address TEXT PRIMARY KEY,
        chain_type TEXT NOT NULL DEFAULT 'evm',
        label TEXT,
        added_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_value TEXT NOT NULL,
        total_change_24h TEXT NOT NULL,
        assets_json TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS asset_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        chain TEXT NOT NULL,
        balance TEXT NOT NULL,
        value TEXT NOT NULL,
        price TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_asset_history_symbol_timestamp
    ON asset_history(symbol, timestamp DESC);

    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        metadata TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS transactions (
        signature TEXT PRIMARY KEY,
        wallet_address TEXT NOT NULL,
        chain TEXT NOT NULL,
        type TEXT NOT NULL,
        symbol TEXT NOT NULL,
        amount TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        status TEXT NOT NULL,
        label TEXT,
        raw_data TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_created_at
    ON alerts(created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_alerts_is_read
    ON alerts(is_read, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_transactions_timestamp
    ON transactions(timestamp DESC);

    CREATE TABLE IF NOT EXISTS rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS rule_artifacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id INTEGER NOT NULL REFERENCES rules(id),
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        output_path TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        compiled_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_rule_artifacts_rule_id
    ON rule_artifacts(rule_id);
`);
// Seed 6 realistic wallets
const initialWallets = [
    { address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', chain_type: 'evm', label: 'Base Main' },
    { address: '0x123f681646d4a755815f9cb19e1acc8565a0c2ac', chain_type: 'evm', label: 'Base Savings' },
    { address: '0xdaaea0658ae0357736465389658f89582d1b6cd5', chain_type: 'evm', label: 'Base Yield' },
    { address: '0x53461e64d03045095e7834578905345789012345', chain_type: 'evm', label: 'Base Trading' }
];
const insertWallet = db.prepare('INSERT OR IGNORE INTO wallets (address, chain_type, label) VALUES (?, ?, ?)');
for (const wallet of initialWallets) {
    insertWallet.run(wallet.address, wallet.chain_type, wallet.label);
}
console.log('Database initialized and seeded successfully.');
db.close();
