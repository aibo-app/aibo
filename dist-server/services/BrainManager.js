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
exports.BrainManager = void 0;
const node_child_process_1 = require("node:child_process");
const path = __importStar(require("node:path"));
const fs = __importStar(require("node:fs"));
const SettingsService_1 = require("./SettingsService");
const OpenClawConfigService_1 = require("./OpenClawConfigService");
const SkillRegistryService_1 = require("./SkillRegistryService");
class BrainManager {
    static instance;
    brainProcess = null;
    coreDir;
    isRunning = false;
    isRestarting = false;
    skillsWatcher = null;
    skillReloadTimer = null;
    constructor() {
        // Priority: env var from Electron > __dirname-relative paths > cwd fallback
        if (process.env.OPENCLAW_CORE_PATH && fs.existsSync(process.env.OPENCLAW_CORE_PATH)) {
            this.coreDir = process.env.OPENCLAW_CORE_PATH;
        }
        else {
            // Dev: __dirname is server/services, so ../openclaw-core = server/openclaw-core
            this.coreDir = path.join(__dirname, '..', 'openclaw-core');
            if (!fs.existsSync(this.coreDir)) {
                // Compiled (dist-server/services/): go up to project root, then server/
                this.coreDir = path.join(__dirname, '..', '..', 'server', 'openclaw-core');
            }
        }
    }
    static getInstance() {
        if (!BrainManager.instance) {
            BrainManager.instance = new BrainManager();
        }
        return BrainManager.instance;
    }
    getCoreDir() {
        return this.coreDir;
    }
    async start() {
        if (this.isRunning)
            return;
        // Initialize dependent services with core dir
        OpenClawConfigService_1.OpenClawConfigService.getInstance().setCoreDir(this.coreDir);
        SkillRegistryService_1.SkillRegistryService.getInstance().setCoreDir(this.coreDir);
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
            }
            catch (e) {
                console.warn('⚠️ [BrainManager] Dependency install failed. If built properly, this may be ignored.', e);
            }
        }
        // Read API keys from settings DB (fall back to env vars)
        const settingsService = SettingsService_1.SettingsService.getInstance();
        const savedSettings = await settingsService.getAll();
        const channelsEnabled = await settingsService.getBoolean('OPENCLAW_CHANNELS_ENABLED');
        // Generate fresh OpenClaw config before starting
        await OpenClawConfigService_1.OpenClawConfigService.getInstance().generateConfig();
        // 2. Start Gateway
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
            this.brainProcess = (0, node_child_process_1.spawn)(nodePath, spawnArgs, {
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
                if (output.includes('listening on ws') ||
                    output.includes('Gateway started') ||
                    output.includes('server started')) {
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
                if (output.includes('listening on ws')) {
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
    runCommand(cmd, args) {
        return new Promise((resolve, reject) => {
            const p = (0, node_child_process_1.spawn)(cmd, args, { cwd: this.coreDir, stdio: 'inherit' });
            p.on('exit', (code) => {
                if (code === 0)
                    resolve();
                else
                    reject(new Error(`${cmd} failed with code ${code}`));
            });
        });
    }
    /**
     * Hot-reload: regenerate config and send SIGUSR1 to Brain (no process restart).
     * Falls back to full restart on Windows or if signal delivery fails.
     */
    async reload() {
        if (process.platform === 'win32') {
            console.log('🔄 [BrainManager] SIGUSR1 not available on Windows, falling back to full restart.');
            return this.restart();
        }
        if (!this.brainProcess || !this.isRunning) {
            console.log('🔄 [BrainManager] Brain not running, performing full start.');
            return this.start();
        }
        await OpenClawConfigService_1.OpenClawConfigService.getInstance().generateConfig();
        console.log(`⚡ [BrainManager] Sending SIGUSR1 to Brain (PID ${this.brainProcess.pid}) for hot-reload...`);
        const sent = this.brainProcess.kill('SIGUSR1');
        if (!sent) {
            console.warn('⚠️ [BrainManager] SIGUSR1 failed to send, falling back to full restart.');
            return this.restart();
        }
        console.log('⚡ [BrainManager] SIGUSR1 sent. Brain will hot-reload config.');
    }
    async restart() {
        if (this.isRestarting)
            return;
        this.isRestarting = true;
        console.log('🔄 [BrainManager] Restarting Brain with updated settings...');
        try {
            this.stop();
            // Brief pause to let the port free up
            await new Promise(r => setTimeout(r, 1500));
            await this.start();
            console.log('🟢 [BrainManager] Brain restarted successfully.');
        }
        catch (err) {
            console.error('❌ [BrainManager] Restart failed:', err);
        }
        finally {
            this.isRestarting = false;
        }
    }
    stop() {
        this.stopSkillsWatcher();
        if (this.brainProcess) {
            this.brainProcess.kill();
            this.brainProcess = null;
            this.isRunning = false;
        }
    }
    /** Watch skills/ directory for SKILL.md changes → trigger hot-reload */
    startSkillsWatcher() {
        const workspaceDir = path.join(__dirname, '..', '..');
        const skillsDir = path.join(workspaceDir, 'skills');
        if (!fs.existsSync(skillsDir))
            return;
        try {
            this.skillsWatcher = fs.watch(skillsDir, { recursive: true }, (_eventType, filename) => {
                if (!filename || !filename.endsWith('SKILL.md'))
                    return;
                console.log(`📋 [BrainManager] Skill change detected: ${filename}`);
                // Debounce: multiple events fire for a single save
                if (this.skillReloadTimer)
                    clearTimeout(this.skillReloadTimer);
                this.skillReloadTimer = setTimeout(() => {
                    this.skillReloadTimer = null;
                    this.reload().catch(err => {
                        console.error('📋 [BrainManager] Skill hot-reload failed:', err);
                    });
                }, 1000);
            });
            console.log(`👁️ [BrainManager] Watching skills directory: ${skillsDir}`);
        }
        catch (err) {
            console.warn('⚠️ [BrainManager] Failed to watch skills directory:', err);
        }
    }
    stopSkillsWatcher() {
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
exports.BrainManager = BrainManager;
