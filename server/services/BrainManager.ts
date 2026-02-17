import { spawn, execSync, ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as net from 'node:net';
import { SettingsService } from './SettingsService';
import { OpenClawConfigService } from './OpenClawConfigService';
import { SkillRegistryService } from './SkillRegistryService';

export class BrainManager {
    private static instance: BrainManager;
    private brainProcess: ChildProcess | null = null;
    private coreDir: string;
    private isRunning = false;
    private isRestarting = false;
    private skillsWatcher: fs.FSWatcher | null = null;
    private skillReloadTimer: ReturnType<typeof setTimeout> | null = null;

    private constructor() {
        // Priority: env var from Electron > __dirname-relative paths > cwd fallback
        if (process.env.OPENCLAW_CORE_PATH && fs.existsSync(process.env.OPENCLAW_CORE_PATH)) {
            this.coreDir = process.env.OPENCLAW_CORE_PATH;
        } else {
            // Dev: __dirname is server/services, so ../openclaw-core = server/openclaw-core
            this.coreDir = path.join(__dirname, '..', 'openclaw-core');
            if (!fs.existsSync(this.coreDir)) {
                // Compiled (dist-server/services/): go up to project root, then server/
                this.coreDir = path.join(__dirname, '..', '..', 'server', 'openclaw-core');
            }
        }
    }

    public static getInstance(): BrainManager {
        if (!BrainManager.instance) {
            BrainManager.instance = new BrainManager();
        }
        return BrainManager.instance;
    }

    public getCoreDir(): string {
        return this.coreDir;
    }

    public async start(): Promise<void> {
        if (this.isRunning) return;

        // Initialize dependent services with core dir
        OpenClawConfigService.getInstance().setCoreDir(this.coreDir);
        SkillRegistryService.getInstance().setCoreDir(this.coreDir);

        console.log(`🧠 [BrainManager] Initializing Embedded Brain at ${this.coreDir}...`);

        if (!fs.existsSync(this.coreDir)) {
            console.error('❌ [BrainManager] OpenClaw core not found!');
            return;
        }

        // 1. Check for node_modules (only in dev, skip in production/read-only)
        const nodeModulesPath = path.join(this.coreDir, 'node_modules');
        const isProduction = process.env.NODE_ENV === 'production';

        if (!fs.existsSync(nodeModulesPath) && !isProduction) {
            console.log('📦 [BrainManager] Installing OpenClaw dependencies (First run)...');
            try {
                await this.runCommand('pnpm', ['install']);
            } catch (e) {
                console.warn('⚠️ [BrainManager] Dependency install failed. If built properly, this may be ignored.', e);
            }
        }

        // Read API keys from settings DB (fall back to env vars)
        const settingsService = SettingsService.getInstance();
        const savedSettings = await settingsService.getAll();
        const channelsEnabled = await settingsService.getBoolean('OPENCLAW_CHANNELS_ENABLED');

        // Generate fresh OpenClaw config before starting
        await OpenClawConfigService.getInstance().generateConfig();

        // 2. Clear port if an external gateway is already running
        await this.clearGatewayPort(18789);

        // 3. Start Gateway
        return new Promise((resolve, reject) => {
            console.log('🚀 [BrainManager] Spawning OpenClaw Gateway...');

            // Resolve best node path
            let nodePath = 'node';
            if (process.platform === 'darwin') {
                // Prefer brewed Node 22+ if available
                const brewNode22 = '/opt/homebrew/opt/node@22/bin/node';
                if (fs.existsSync(brewNode22)) {
                    nodePath = brewNode22;
                }
            }
            // In packaged Electron (ELECTRON_RUN_AS_NODE), use same executable as fallback
            if (process.env.ELECTRON_RUN_AS_NODE && nodePath === 'node') {
                nodePath = process.execPath;
            }

            const stateDir = path.join(this.coreDir, 'data');
            if (!fs.existsSync(stateDir)) {
                fs.mkdirSync(stateDir, { recursive: true });
            }

            // Set workspace to Aibō project root for custom skills
            // BrainManager is in server/services, so go up to project root
            const workspaceDir = path.join(__dirname, '..', '..');
            const aiboSkillsDir = path.join(workspaceDir, 'skills');
            if (!fs.existsSync(aiboSkillsDir)) {
                console.log('📋 [BrainManager] Creating Aibō skills directory...');
                fs.mkdirSync(aiboSkillsDir, { recursive: true });
            }

            const distEntryPath = path.join(this.coreDir, 'dist', 'entry.js');
            const runnerPath = path.join(this.coreDir, 'scripts', 'run-node.mjs');

            const useBundled = fs.existsSync(distEntryPath);
            const entryScript = useBundled ? distEntryPath : (fs.existsSync(runnerPath) ? runnerPath : 'src/entry.ts');

            const spawnArgs = [entryScript, 'gateway', '--force', '--allow-unconfigured', '--dev'];

            console.log(`⚡ [BrainManager] v1.2.3 - Starting Brain in ${useBundled ? 'Bundled' : 'Source'} mode...`);

            this.brainProcess = spawn(nodePath, spawnArgs, {
                cwd: this.coreDir,
                stdio: ['inherit', 'pipe', 'pipe'], // inherit stdin for safety, pipe out
                env: {
                    ...process.env,
                    OPENCLAW_STATE_DIR: stateDir,
                    OPENCLAW_WORKSPACE: workspaceDir,
                    OPENCLAW_CONFIG_PATH: path.join(stateDir, 'openclaw.json'),
                    OPENCLAW_GATEWAY_PORT: '18789',
                    OPENCLAW_GATEWAY_TOKEN: 'aibo',
                    ...(channelsEnabled ? {} : { OPENCLAW_SKIP_CHANNELS: '1' }),
                    OPENCLAW_NO_RESPAWN: '1',
                    OPENCLAW_NODE_OPTIONS_READY: '1',
                    DEEPSEEK_API_KEY: savedSettings.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || '',
                    OPENAI_API_KEY: savedSettings.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '',
                    ANTHROPIC_API_KEY: savedSettings.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '',
                    BRAVE_API_KEY: savedSettings.BRAVE_API_KEY || process.env.BRAVE_API_KEY || '',
                }
            });

            this.brainProcess.on('error', (err) => {
                console.error('❌ [BrainManager] Process failed to spawn:', err);
                reject(err);
            });

            const buildPulse = setInterval(() => {
                if (!this.isRunning) {
                    // console.log('⏳ [BrainManager] Brain is still building/initializing...');
                }
            }, 30000); // 30s pulse instead of 10s

            const timeout = setTimeout(() => {
                clearInterval(buildPulse);
                if (!this.isRunning) {
                    reject(new Error('Brain startup timed out (120s). Please check if another process is on 18789.'));
                }
            }, 120000);

            this.brainProcess.stdout?.on('data', (data) => {
                const output = data.toString();
                // process.stdout.write(`🧠 [Brain] ${output}`); // Silenced raw stdout duplication unless it's a signal

                // Detect actual server-ready signals (NOT 'agent model:' which fires during init)
                // Exclude error messages like "already listening on ws" or "failed to start"
                const isReady = (output.includes('listening on ws') || output.includes('Gateway started') || output.includes('server started'))
                    && !output.includes('failed') && !output.includes('already');
                if (isReady) {
                    if (!this.isRunning) {
                        const matched = output.trim().substring(0, 120);
                        console.log(`🟢 [BrainManager] Gateway Ready (stdout): "${matched}"`);
                        this.isRunning = true;
                        this.startSkillsWatcher();
                        clearInterval(buildPulse);
                        clearTimeout(timeout);
                        resolve();
                    }
                }
            });

            this.brainProcess.stderr?.on('data', (data) => {
                const output = data.toString();
                // Log brain stderr for diagnostics (policy violations, config errors, etc.)
                const trimmed = output.trim();
                if (trimmed) {
                    process.stderr.write(`🧠 [Brain] ${trimmed}\n`);
                }

                const isReadyStderr = output.includes('listening on ws')
                    && !output.includes('failed') && !output.includes('already');
                if (isReadyStderr) {
                    if (!this.isRunning) {
                        const matched = output.trim().substring(0, 120);
                        console.log(`🟢 [BrainManager] Gateway Ready (stderr): "${matched}"`);
                        this.isRunning = true;
                        this.startSkillsWatcher();
                        clearInterval(buildPulse);
                        clearTimeout(timeout);
                        resolve();
                    }
                }
            });

            this.brainProcess.on('exit', (code, signal) => {
                clearInterval(buildPulse);
                if (!this.isRunning) {
                    clearTimeout(timeout);
                    reject(new Error(`Brain exited early with code ${code} and signal ${signal}`));
                }
                console.warn(`🟠 [BrainManager] Brain exited with code ${code} and signal ${signal}`);
                this.isRunning = false;
            });
        });
    }

    private runCommand(cmd: string, args: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const p = spawn(cmd, args, { cwd: this.coreDir, stdio: 'inherit' });
            p.on('exit', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`${cmd} failed with code ${code}`));
            });
        });
    }

    /** Check if a port is in use and stop the occupying process so our gateway can bind. */
    private async clearGatewayPort(port: number): Promise<void> {
        const inUse = await new Promise<boolean>(resolve => {
            const sock = new net.Socket();
            sock.setTimeout(1000);
            sock.once('connect', () => { sock.destroy(); resolve(true); });
            sock.once('error', () => { sock.destroy(); resolve(false); });
            sock.once('timeout', () => { sock.destroy(); resolve(false); });
            sock.connect(port, '127.0.0.1');
        });

        if (!inUse) return;

        console.log(`⚠️ [BrainManager] Port ${port} in use — stopping existing gateway...`);

        // On macOS, the gateway may be a launchd service that respawns after kill.
        // Must bootout the service first, then kill the process.
        if (process.platform === 'darwin') {
            try {
                const uid = process.getuid?.() ?? 501;
                execSync(`launchctl bootout gui/${uid}/ai.openclaw.gateway 2>/dev/null`, { encoding: 'utf8' });
                console.log(`⚠️ [BrainManager] Unloaded launchd service ai.openclaw.gateway`);
                await new Promise(r => setTimeout(r, 1500));

                // Verify port freed
                const stillInUse = await new Promise<boolean>(resolve => {
                    const s = new net.Socket();
                    s.setTimeout(500);
                    s.once('connect', () => { s.destroy(); resolve(true); });
                    s.once('error', () => { s.destroy(); resolve(false); });
                    s.once('timeout', () => { s.destroy(); resolve(false); });
                    s.connect(port, '127.0.0.1');
                });
                if (!stillInUse) return;
            } catch {
                // Not a launchd service or bootout failed — fall through to kill
            }
        }

        // Fallback: kill process on the port directly
        try {
            const pid = execSync(`lsof -t -i :${port}`, { encoding: 'utf8' }).trim();
            if (pid) {
                process.kill(parseInt(pid), 'SIGTERM');
                console.log(`⚠️ [BrainManager] Sent SIGTERM to PID ${pid}`);
                await new Promise(r => setTimeout(r, 2000));
            }
        } catch {
            console.warn(`⚠️ [BrainManager] Could not clear port ${port}. Gateway may fail to start.`);
        }
    }

    /**
     * Hot-reload: regenerate config and send SIGUSR1 to Brain (no process restart).
     * Falls back to full restart on Windows or if signal delivery fails.
     */
    public async reload(): Promise<void> {
        if (process.platform === 'win32') {
            console.log('🔄 [BrainManager] SIGUSR1 not available on Windows, falling back to full restart.');
            return this.restart();
        }

        if (!this.brainProcess || !this.isRunning) {
            console.log('🔄 [BrainManager] Brain not running, performing full start.');
            return this.start();
        }

        await OpenClawConfigService.getInstance().generateConfig();

        console.log(`⚡ [BrainManager] Sending SIGUSR1 to Brain (PID ${this.brainProcess.pid}) for hot-reload...`);
        const sent = this.brainProcess.kill('SIGUSR1');
        if (!sent) {
            console.warn('⚠️ [BrainManager] SIGUSR1 failed to send, falling back to full restart.');
            return this.restart();
        }
        console.log('⚡ [BrainManager] SIGUSR1 sent. Brain will hot-reload config.');
    }

    public async restart(): Promise<void> {
        if (this.isRestarting) return;
        this.isRestarting = true;
        console.log('🔄 [BrainManager] Restarting Brain with updated settings...');
        try {
            this.stop();
            // Brief pause to let the port free up
            await new Promise(r => setTimeout(r, 1500));
            await this.start();
            console.log('🟢 [BrainManager] Brain restarted successfully.');
        } catch (err) {
            console.error('❌ [BrainManager] Restart failed:', err);
        } finally {
            this.isRestarting = false;
        }
    }

    public stop() {
        this.stopSkillsWatcher();
        if (this.brainProcess) {
            this.brainProcess.kill();
            this.brainProcess = null;
            this.isRunning = false;
        }
    }

    /** Watch skills/ directory for SKILL.md changes → trigger hot-reload */
    private startSkillsWatcher(): void {
        const workspaceDir = path.join(__dirname, '..', '..');
        const skillsDir = path.join(workspaceDir, 'skills');

        if (!fs.existsSync(skillsDir)) return;

        try {
            this.skillsWatcher = fs.watch(skillsDir, { recursive: true }, (_eventType, filename) => {
                if (!filename || !filename.endsWith('SKILL.md')) return;

                console.log(`📋 [BrainManager] Skill change detected: ${filename}`);

                // Debounce: multiple events fire for a single save
                if (this.skillReloadTimer) clearTimeout(this.skillReloadTimer);
                this.skillReloadTimer = setTimeout(() => {
                    this.skillReloadTimer = null;
                    this.reload().catch(err => {
                        console.error('📋 [BrainManager] Skill hot-reload failed:', err);
                    });
                }, 1000);
            });
            console.log(`👁️ [BrainManager] Watching skills directory: ${skillsDir}`);
        } catch (err) {
            console.warn('⚠️ [BrainManager] Failed to watch skills directory:', err);
        }
    }

    private stopSkillsWatcher(): void {
        if (this.skillsWatcher) {
            this.skillsWatcher.close();
            this.skillsWatcher = null;
        }
        if (this.skillReloadTimer) {
            clearTimeout(this.skillReloadTimer);
            this.skillReloadTimer = null;
        }
    }
}
