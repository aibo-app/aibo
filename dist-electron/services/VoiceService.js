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
exports.VoiceService = void 0;
exports.getVoiceService = getVoiceService;
const child_process_1 = require("child_process");
const events_1 = require("events");
const path = __importStar(require("path"));
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
class VoiceService extends events_1.EventEmitter {
    pythonProcess = null;
    isRunning = false;
    buffer = '';
    constructor() {
        super();
    }
    start() {
        if (this.isRunning) {
            console.log('[VoiceService] Already running');
            return;
        }
        const scriptPath = path.join(electron_1.app.getAppPath(), 'scripts', 'voice_listener.py');
        console.log('[VoiceService] Attempting to start Python process at:', scriptPath);
        try {
            // Check if file exists
            if (!fs.existsSync(scriptPath)) {
                console.error('[VoiceService] Script not found at:', scriptPath);
                this.emit('error', `Script not found: ${scriptPath}`);
                return;
            }
            // Try python3 first, fall back to python
            this.pythonProcess = (0, child_process_1.spawn)('python3', [scriptPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env }
            });
            this.isRunning = true;
            // Handle stdout - JSON messages from Python
            this.pythonProcess.stdout?.on('data', (data) => {
                this.buffer += data.toString();
                // Process complete lines (JSON messages)
                const lines = this.buffer.split('\n');
                this.buffer = lines.pop() || ''; // Keep incomplete line in buffer
                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const message = JSON.parse(line);
                            this.handleMessage(message);
                        }
                        catch {
                            console.log('[VoiceService] Non-JSON output:', line);
                        }
                    }
                }
            });
            // Handle stderr
            this.pythonProcess.stderr?.on('data', (data) => {
                const text = data.toString().trim();
                if (text && !text.includes('UserWarning') && !text.includes('FutureWarning')) {
                    console.error('[VoiceService] Python stderr:', text);
                }
            });
            // Handle process exit
            this.pythonProcess.on('close', (code) => {
                console.log('[VoiceService] Python process exited with code:', code);
                this.isRunning = false;
                this.pythonProcess = null;
                this.emit('stopped', code);
            });
            this.pythonProcess.on('error', (err) => {
                console.error('[VoiceService] Failed to start Python process:', err);
                this.isRunning = false;
                this.emit('error', err.message);
            });
        }
        catch (error) {
            console.error('[VoiceService] Error starting:', error);
            this.emit('error', error.message);
        }
    }
    handleMessage(message) {
        console.log('[VoiceService] Message:', message.type, message.text || message.message || '');
        switch (message.type) {
            case 'ready':
                this.emit('ready');
                break;
            case 'transcription':
                if (message.text) {
                    this.emit('transcription', message.text);
                }
                break;
            case 'recording_start':
                this.emit('recording_start');
                break;
            case 'recording_stop':
                this.emit('recording_stop');
                break;
            case 'error':
                this.emit('error', message.message || 'Unknown error');
                break;
            case 'status':
                console.log('[VoiceService] Status:', message.message);
                break;
            case 'shutdown':
                this.isRunning = false;
                break;
        }
    }
    stop() {
        if (this.pythonProcess) {
            console.log('[VoiceService] Stopping Python process');
            this.pythonProcess.kill('SIGTERM');
            this.pythonProcess = null;
            this.isRunning = false;
        }
    }
    isActive() {
        return this.isRunning;
    }
}
exports.VoiceService = VoiceService;
// Singleton instance
let voiceServiceInstance = null;
function getVoiceService() {
    if (!voiceServiceInstance) {
        voiceServiceInstance = new VoiceService();
    }
    return voiceServiceInstance;
}
