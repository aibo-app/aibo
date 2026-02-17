"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretStoreService = exports.SECRET_SETTING_KEYS = void 0;
const node_child_process_1 = require("node:child_process");
const KEYCHAIN_ACCOUNT = 'aibo';
const KEYCHAIN_PREFIX = 'aibo/';
/** Keys that should be stored in the system secure store instead of SQLite */
exports.SECRET_SETTING_KEYS = new Set([
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'DEEPSEEK_API_KEY',
]);
/**
 * SecretStoreService — stores sensitive API keys in the macOS Keychain.
 * On non-macOS platforms, returns null and falls through to SQLite.
 */
class SecretStoreService {
    static instance;
    isMac;
    constructor() {
        this.isMac = process.platform === 'darwin';
    }
    static getInstance() {
        if (!SecretStoreService.instance) {
            SecretStoreService.instance = new SecretStoreService();
        }
        return SecretStoreService.instance;
    }
    isSecretKey(key) {
        return exports.SECRET_SETTING_KEYS.has(key);
    }
    get(key) {
        if (!this.isMac)
            return null;
        try {
            const result = (0, node_child_process_1.execFileSync)('security', [
                'find-generic-password',
                '-a', KEYCHAIN_ACCOUNT,
                '-s', `${KEYCHAIN_PREFIX}${key}`,
                '-w',
            ], { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
            return result.trim() || null;
        }
        catch {
            return null;
        }
    }
    set(key, value) {
        if (!this.isMac)
            return false;
        try {
            // -U flag: update if exists, add if not
            (0, node_child_process_1.execFileSync)('security', [
                'add-generic-password',
                '-a', KEYCHAIN_ACCOUNT,
                '-s', `${KEYCHAIN_PREFIX}${key}`,
                '-w', value,
                '-U',
            ], { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
            return true;
        }
        catch {
            return false;
        }
    }
    delete(key) {
        if (!this.isMac)
            return false;
        try {
            (0, node_child_process_1.execFileSync)('security', [
                'delete-generic-password',
                '-a', KEYCHAIN_ACCOUNT,
                '-s', `${KEYCHAIN_PREFIX}${key}`,
            ], { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.SecretStoreService = SecretStoreService;
