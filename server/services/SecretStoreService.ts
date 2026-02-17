import { execFileSync } from 'node:child_process';

const KEYCHAIN_ACCOUNT = 'aibo';
const KEYCHAIN_PREFIX = 'aibo/';

/** Keys that should be stored in the system secure store instead of SQLite */
export const SECRET_SETTING_KEYS = new Set([
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'DEEPSEEK_API_KEY',
]);

/**
 * SecretStoreService — stores sensitive API keys in the macOS Keychain.
 * On non-macOS platforms, returns null and falls through to SQLite.
 */
export class SecretStoreService {
    private static instance: SecretStoreService;
    private isMac: boolean;

    private constructor() {
        this.isMac = process.platform === 'darwin';
    }

    public static getInstance(): SecretStoreService {
        if (!SecretStoreService.instance) {
            SecretStoreService.instance = new SecretStoreService();
        }
        return SecretStoreService.instance;
    }

    public isSecretKey(key: string): boolean {
        return SECRET_SETTING_KEYS.has(key);
    }

    public get(key: string): string | null {
        if (!this.isMac) return null;

        try {
            const result = execFileSync('security', [
                'find-generic-password',
                '-a', KEYCHAIN_ACCOUNT,
                '-s', `${KEYCHAIN_PREFIX}${key}`,
                '-w',
            ], { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
            return result.trim() || null;
        } catch {
            return null;
        }
    }

    public set(key: string, value: string): boolean {
        if (!this.isMac) return false;

        try {
            // -U flag: update if exists, add if not
            execFileSync('security', [
                'add-generic-password',
                '-a', KEYCHAIN_ACCOUNT,
                '-s', `${KEYCHAIN_PREFIX}${key}`,
                '-w', value,
                '-U',
            ], { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
            return true;
        } catch {
            return false;
        }
    }

    public delete(key: string): boolean {
        if (!this.isMac) return false;

        try {
            execFileSync('security', [
                'delete-generic-password',
                '-a', KEYCHAIN_ACCOUNT,
                '-s', `${KEYCHAIN_PREFIX}${key}`,
            ], { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
            return true;
        } catch {
            return false;
        }
    }
}
