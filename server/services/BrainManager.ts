import { spawn, ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export class BrainManager {
    private static instance: BrainManager;
    private brainProcess: ChildProcess | null = null;
    private coreDir: string;
    private isRunning = false;

    private constructor() {
        this.coreDir = path.join(process.cwd(), 'server', 'openclaw-core');
        // Handle case where we are already in server
        if (!fs.existsSync(this.coreDir)) {
            this.coreDir = path.join(process.cwd(), 'openclaw-core');
        }
    }

    public static getInstance(): BrainManager {
        if (!BrainManager.instance) {
            BrainManager.instance = new BrainManager();
        }
        return BrainManager.instance;
    }

    public async start(): Promise<void> {
        if (this.isRunning) return;

        console.log(`🧠 [BrainManager] Initializing Embedded Brain at ${this.coreDir}...`);

        if (!fs.existsSync(this.coreDir)) {
            console.error('❌ [BrainManager] OpenClaw core not found!');
            return;
        }

        // 1. Check for node_modules
        const nodeModulesPath = path.join(this.coreDir, 'node_modules');
        if (!fs.existsSync(nodeModulesPath)) {
            console.log('📦 [BrainManager] Installing OpenClaw dependencies (First run)...');
            await this.runCommand('pnpm', ['install']);
        }

        // 2. Start Gateway
        return new Promise((resolve, reject) => {
            console.log('🚀 [BrainManager] Spawning OpenClaw Gateway...');

            // Resolve best node path (Prefer Node 22+ if it's keg-only/brewed)
            let nodePath = 'node';
            const brewNode22 = '/opt/homebrew/opt/node@22/bin/node';
            if (process.platform === 'darwin' && fs.existsSync(brewNode22)) {
                nodePath = brewNode22;
            }

            const stateDir = path.join(this.coreDir, 'data');
            if (!fs.existsSync(stateDir)) {
                fs.mkdirSync(stateDir, { recursive: true });
            }

            const distEntryPath = path.join(this.coreDir, 'dist', 'entry.js');
            const runnerPath = path.join(this.coreDir, 'scripts', 'run-node.mjs');

            const useBundled = fs.existsSync(distEntryPath);
            const entryScript = useBundled ? distEntryPath : (fs.existsSync(runnerPath) ? runnerPath : 'src/entry.ts');

            const spawnArgs = [entryScript, 'gateway', '--force', '--allow-unconfigured', '--dev'];

            console.log(`⚡ [BrainManager] v1.2.3 - Starting Brain in ${useBundled ? 'Bundled' : 'Source'} mode...`);
            // CMD logging disabled for cleaner terminal output

            this.brainProcess = spawn(nodePath, spawnArgs, {
                cwd: this.coreDir,
                stdio: ['inherit', 'pipe', 'pipe'], // inherit stdin for safety, pipe out
                env: {
                    ...process.env,
                    OPENCLAW_STATE_DIR: stateDir,
                    OPENCLAW_GATEWAY_PORT: '18789',
                    OPENCLAW_GATEWAY_TOKEN: 'aibo',
                    OPENCLAW_SKIP_CHANNELS: '1',
                    OPENCLAW_NO_RESPAWN: '1',
                    OPENCLAW_NODE_OPTIONS_READY: '1',
                    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || ''
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

                // Broaden readiness detection to catch v3 signals
                if (output.includes('listening on ws') ||
                    output.includes('agent model:') ||
                    output.includes('Gateway started') ||
                    output.includes('server started')) {
                    if (!this.isRunning) {
                        console.log('🟢 [BrainManager] Gateway Ready Signal Detected!');
                        this.isRunning = true;
                        clearInterval(buildPulse);
                        clearTimeout(timeout);
                        resolve();
                    }
                }
            });

            this.brainProcess.stderr?.on('data', (data) => {
                const output = data.toString();
                // Filter out common Fastify/Vite/Zod logs to keep terminal clean
                if (output.includes('Invalid config') || output.includes('Error') || output.includes('Missing env')) {
                    process.stderr.write(`🧠 [Brain/ERR] ${output}`);
                }

                if (output.includes('listening on ws')) {
                    if (!this.isRunning) {
                        console.log('🟢 [BrainManager] Gateway Ready Signal Detected!');
                        this.isRunning = true;
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

    public stop() {
        if (this.brainProcess) {
            this.brainProcess.kill();
            this.brainProcess = null;
            this.isRunning = false;
        }
    }
}
