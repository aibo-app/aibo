/**
 * Python Voice Bridge - Spawns and communicates with the Python STT service
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';

export class PythonVoiceBridge {
    private static instance: PythonVoiceBridge | null = null;
    private process: ChildProcess | null = null;
    private isReady = false;
    private retryCount = 0;
    private maxRetries = 3;
    private onTranscript: ((text: string, isFinal: boolean) => void) | null = null;
    private onStatus: ((status: string) => void) | null = null;
    private startPromise: { resolve: () => void, reject: (err: any) => void } | null = null;
    private heartbeatTimeout: NodeJS.Timeout | null = null;

    static getInstance(): PythonVoiceBridge {
        if (!this.instance) {
            this.instance = new PythonVoiceBridge();
        }
        return this.instance;
    }

    async start(): Promise<void> {
        if (this.process) {
            console.log('[PythonBridge] Already running');
            return;
        }

        // Pre-flight check: Ensure Python dependencies are available
        const depsOk = await this.checkDependencies();
        if (!depsOk) {
            console.error('[PythonBridge] Dependency check failed. Voice service will not start.');
            if (this.onStatus) this.onStatus('error:dependencies_missing');
            return;
        }

        const scriptPath = path.join(__dirname, '../../scripts/voice_service.py');

        if (!fs.existsSync(scriptPath)) {
            const err = `[PythonBridge] Script not found at ${scriptPath}`;
            console.error(err);
            throw new Error(err);
        }

        console.log('[PythonBridge] Starting Python voice service...');

        this.process = spawn('python3', [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, PYTHONUNBUFFERED: '1' }
        });

        // Handle stdout (JSON messages)
        const rl = readline.createInterface({
            input: this.process.stdout!,
            crlfDelay: Infinity
        });

        rl.on('line', (line) => {
            try {
                const message = JSON.parse(line);
                this.handleMessage(message);
            } catch (e) {
                // Only log if it's not looking like progress noise
                if (line.trim()) console.log('[PythonBridge] Raw output:', line);
            }
        });

        // Handle stderr (logs)
        this.process.stderr?.on('data', (data) => {
            console.log('[PythonBridge] Log:', data.toString().trim());
        });

        // Handle process exit
        this.process.on('exit', (code) => {
            console.log(`[PythonBridge] Process exited with code ${code}`);
            this.process = null;
            this.isReady = false;

            if (code !== 0 && this.retryCount < this.maxRetries) {
                this.retryCount++;
                const delay = this.retryCount * 2000;
                console.log(`[PythonBridge] Attempting restart ${this.retryCount}/${this.maxRetries} in ${delay}ms...`);
                setTimeout(() => this.start(), delay);
            } else if (code !== 0) {
                console.error('[PythonBridge] Max retries reached. Voice service unavailable.');
                if (this.startPromise) {
                    this.startPromise.reject(new Error(`Voice service failed after ${this.maxRetries} retries`));
                    this.startPromise = null;
                }
            }
        });

        this.process.on('error', (error) => {
            console.error('[PythonBridge] Process error:', error);
            this.process = null;
            this.isReady = false;
        });

        // Wait for ready signal
        return new Promise((resolve, reject) => {
            this.startPromise = { resolve, reject };
            const timeout = setTimeout(() => {
                if (this.startPromise) {
                    this.startPromise.reject(new Error('Python voice service timed out'));
                    this.startPromise = null;
                }
            }, 30000);

            const checkReady = setInterval(() => {
                if (this.isReady) {
                    clearInterval(checkReady);
                    clearTimeout(timeout);
                    if (this.startPromise) {
                        this.startPromise.resolve();
                        this.startPromise = null;
                        this.retryCount = 0; // Reset on success
                    }
                }
            }, 100);
        });
    }

    private handleMessage(message: { type: string; text?: string; is_final?: boolean; status?: string; message?: string }) {
        switch (message.type) {
            case 'status':
                if (message.status === 'ready') {
                    this.isReady = true;
                    console.log('[PythonBridge] Voice service ready!');
                }
                if (this.onStatus) {
                    this.onStatus(message.status || '');
                }
                break;
            case 'transcript':
                if (message.text && this.onTranscript) {
                    this.onTranscript(message.text, !!message.is_final);
                }
                break;
            case 'heartbeat':
                this.resetHeartbeatTimer();
                break;
            case 'error':
                console.error('[PythonBridge] Error:', message.message);
                break;
        }
    }

    private async checkDependencies(): Promise<boolean> {
        return new Promise((resolve) => {
            const check = spawn('python3', ['-c', 'import deepgram, dotenv, pyaudio; print("ok")']);
            check.on('close', (code) => resolve(code === 0));
            check.on('error', () => resolve(false));

            // Timeout dependency check after 5s
            setTimeout(() => {
                check.kill();
                resolve(false);
            }, 5000);
        });
    }

    private resetHeartbeatTimer() {
        if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);

        // If we don't get a heartbeat for 30 seconds, the process is likely hung
        this.heartbeatTimeout = setTimeout(() => {
            console.error('[PythonBridge] Heartbeat lost! Process might be hung. Restarting...');
            this.stop();
            this.start();
        }, 30000);
    }

    setOnTranscript(callback: (text: string, isFinal: boolean) => void) {
        this.onTranscript = callback;
    }

    setOnStatus(callback: (status: string) => void) {
        this.onStatus = callback;
    }

    /**
     * Pause mic capture during TTS playback to prevent echo feedback loop
     */
    pause() {
        if (this.process && this.isReady) {
            this.process.stdin?.write('pause\n');
            console.log('[PythonBridge] Sent PAUSE command');
        }
    }

    /**
     * Resume mic capture after TTS finishes
     */
    resume() {
        if (this.process && this.isReady) {
            this.process.stdin?.write('resume\n');
            console.log('[PythonBridge] Sent RESUME command');
        }
    }

    stop() {
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
        if (this.process) {
            this.process.kill();
            this.process = null;
            this.isReady = false;
        }
    }

    getIsReady(): boolean {
        return this.isReady;
    }
}
