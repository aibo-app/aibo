"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.app.setName('Aibō');
const path_1 = __importDefault(require("path"));
const node_child_process_1 = require("node:child_process");
// Auto-updater (production only — checks GitHub Releases)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let autoUpdater = null;
try {
    if (electron_1.app.isPackaged) {
        autoUpdater = require('electron-updater').autoUpdater;
    }
}
catch { /* dev mode — electron-updater not bundled */ }
// import { getVoiceService } from './services/VoiceService'; // REMOVED
// Global references to prevent garbage collection
let mainWindow = null;
let assistantWindow = null;
let tray = null;
let serverProcess = null;
let isQuitting = false;
const isDev = process.env.NODE_ENV === 'development';
const PRELOAD_PATH = path_1.default.join(__dirname, 'preload.js');
const INDEX_URL = isDev ? 'http://localhost:5173' : `file://${path_1.default.join(__dirname, '../dist/index.html')}`;
// Single Instance Lock
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on('second-instance', () => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
            mainWindow.show();
        }
    });
    // Performance: Chromium flags (must be set before app ready)
    electron_1.app.commandLine.appendSwitch('disable-extensions');
    electron_1.app.commandLine.appendSwitch('disable-default-apps');
    electron_1.app.commandLine.appendSwitch('disable-logging');
    electron_1.app.commandLine.appendSwitch('log-level', '3');
    electron_1.app.commandLine.appendSwitch('disable-gpu-vsync'); // Faster rendering
    electron_1.app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion'); // Faster window show
}
/**
 * Create the "Dashboard" Window (Standard Desktop App)
 */
function createMainWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        show: false, // Wait for ready-to-show to prevent blank window
        titleBarStyle: 'hidden',
        trafficLightPosition: { x: -100, y: -100 }, // Hide native controls (we will use custom CSS ones)
        backgroundColor: '#F5F1E8', // Beige background matches app theme - prevents white flash
        webPreferences: {
            preload: PRELOAD_PATH,
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false, // Don't throttle during startup
            spellcheck: false,
            v8CacheOptions: 'bypassHeatCheck',
        },
        icon: path_1.default.join(__dirname, '../public/icon.png'),
    });
    // Set dock icon immediately on macOS
    if (process.platform === 'darwin') {
        const iconPath = path_1.default.join(__dirname, '../public/icon.png');
        electron_1.app.dock.setIcon(iconPath);
        electron_1.app.dock.show();
    }
    console.log(`[Electron] Loading URL: ${INDEX_URL}`);
    console.time('[Electron] URL load time');
    mainWindow.loadURL(INDEX_URL);
    // Show window as soon as React renders (not waiting for data)
    let windowShown = false;
    const showWindow = () => {
        if (windowShown)
            return;
        windowShown = true;
        console.timeEnd('[Electron] URL load time');
        console.timeEnd('[Electron] Total startup time');
        console.log('[Electron] ✅ Window is now visible!');
        mainWindow?.show();
        mainWindow?.focus();
    };
    mainWindow.once('ready-to-show', showWindow);
    // Force-show after 3 seconds even if page hasn't fully rendered
    // Better to show beige background than leave user waiting
    setTimeout(showWindow, 3000);
    // macOS: Hide instead of close (keeps dock icon + server alive)
    // Only truly close on Cmd+Q / tray Quit (isQuitting = true)
    mainWindow.on('close', (e) => {
        if (process.platform === 'darwin' && !isQuitting) {
            e.preventDefault();
            mainWindow?.hide();
            return;
        }
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
/**
 * Create the "Assistant" Window (Floating Siri-like Popup)
 */
function createAssistantWindow() {
    const { width, height } = electron_1.screen.getPrimaryDisplay().workAreaSize;
    // Dimensions for the floating pill
    // ENLARGED: Room for native shadows + diffuse glows
    // REDUCED multiple times as per user requests (600 -> 420 -> 340 -> 260 -> 220)
    // FIXED: Must match or exceed minWidth/minHeight to avoid Electron sizing bugs
    const ASSISTANT_WIDTH = 340;
    const ASSISTANT_HEIGHT = 340;
    // Position at bottom right
    const x = width - ASSISTANT_WIDTH - 20;
    const y = height - ASSISTANT_HEIGHT - 20;
    assistantWindow = new electron_1.BrowserWindow({
        width: ASSISTANT_WIDTH,
        height: ASSISTANT_HEIGHT,
        x,
        y,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        hasShadow: true,
        resizable: false,
        maximizable: false,
        fullscreenable: false,
        alwaysOnTop: true,
        show: false,
        skipTaskbar: false,
        webPreferences: {
            preload: PRELOAD_PATH,
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: true,
            spellcheck: false,
            v8CacheOptions: 'bypassHeatCheck',
        },
        paintWhenInitiallyHidden: false,
    });
    // Ensure it stays on top of EVERYTHING (including full screen apps)
    assistantWindow.setAlwaysOnTop(true, 'screen-saver');
    assistantWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    // Load a specific route for the assistant
    assistantWindow.loadURL(`${INDEX_URL}#/assistant`);
    assistantWindow.once('ready-to-show', () => {
        console.log('[Electron] Assistant window ready-to-show');
        assistantWindow?.show();
        // Keep dock icon visible on macOS even when main window is hidden
        if (process.platform === 'darwin')
            electron_1.app.dock.show();
    });
    assistantWindow.on('closed', () => {
        assistantWindow = null;
    });
    return assistantWindow;
    // Hide on blur (click away) - Standard behavior for spotlight apps
    // assistantWindow.on('blur', () => {
    //   if (!isDev) assistantWindow?.hide();
    // });
}
/**
 * Create Application Menu (Top Bar)
 * Ensures App Name appears correctly in macOS Menu Bar
 */
function createMenu() {
    const isMac = process.platform === 'darwin';
    const template = [
        // { role: 'appMenu' }
        ...(isMac
            ? [{
                    label: electron_1.app.name,
                    submenu: [
                        { role: 'about' },
                        { type: 'separator' },
                        { role: 'services' },
                        { type: 'separator' },
                        { role: 'hide' },
                        { role: 'hideOthers' },
                        { role: 'unhide' },
                        { type: 'separator' },
                        { role: 'quit' }
                    ]
                }]
            : []),
        // { role: 'fileMenu' }
        {
            label: 'File',
            submenu: [
                isMac ? { role: 'close' } : { role: 'quit' }
            ]
        },
        // { role: 'editMenu' }
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        // { role: 'viewMenu' }
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        }
    ];
    const menu = electron_1.Menu.buildFromTemplate(template);
    electron_1.Menu.setApplicationMenu(menu);
}
/**
 * Create System Tray Icon
 */
function createTray() {
    // On macOS, use Template.png suffix for proper menu bar icon (monochrome, adapts to theme)
    const iconPath = path_1.default.join(__dirname, '../public/tray-iconTemplate.png');
    const icon = electron_1.nativeImage.createFromPath(iconPath);
    icon.setTemplateImage(true); // Mark as template for macOS
    tray = new electron_1.Tray(icon);
    const contextMenu = electron_1.Menu.buildFromTemplate([
        {
            label: 'Open Dashboard', click: () => {
                if (mainWindow)
                    mainWindow.show();
                else
                    createMainWindow();
            }
        },
        { label: 'Toggle Assistant', click: toggleAssistant },
        { type: 'separator' },
        { label: 'Quit', click: () => electron_1.app.quit() },
    ]);
    tray.setToolTip('Aibō');
    tray.setContextMenu(contextMenu);
    // Left click toggles assistant
    tray.on('click', toggleAssistant);
}
let isCreatingAssistant = false;
function toggleAssistant() {
    if (assistantWindow && !assistantWindow.isDestroyed()) {
        if (assistantWindow.isVisible()) {
            assistantWindow.hide();
        }
        else {
            assistantWindow.show();
            assistantWindow.focus();
            if (process.platform === 'darwin')
                electron_1.app.dock.show();
        }
        return;
    }
    // Prevent race condition from rapid double-toggle
    if (isCreatingAssistant)
        return;
    isCreatingAssistant = true;
    const win = createAssistantWindow();
    win.once('ready-to-show', () => {
        isCreatingAssistant = false;
        win.show();
        win.focus();
    });
    // Safety fallback in case ready-to-show never fires
    setTimeout(() => { isCreatingAssistant = false; }, 5000);
}
function startBackend() {
    if (isDev) {
        console.log('[Electron] ⚡ Dev mode - backend runs via npm concurrently');
        return; // In dev, we use concurrently in package.json
    }
    if (serverProcess) {
        console.log('[Electron] ⚠️ Backend already running');
        return; // Already running
    }
    console.log('[Electron] 🚀 Starting production backend...');
    const serverPath = path_1.default.join(__dirname, '../dist-server/index.js');
    const userDataDir = electron_1.app.getPath('userData');
    const dataDir = path_1.default.join(userDataDir, 'data');
    // Resolve openclaw-core: check extraResources first, then relative path
    let openclawCorePath = path_1.default.join(process.resourcesPath, 'openclaw-core');
    if (!require('fs').existsSync(openclawCorePath)) {
        openclawCorePath = path_1.default.join(__dirname, '..', 'server', 'openclaw-core');
    }
    serverProcess = (0, node_child_process_1.spawn)(process.execPath, [serverPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            PORT: '3001',
            NODE_ENV: 'production',
            AIBO_DATA_DIR: dataDir,
            OPENCLAW_CORE_PATH: openclawCorePath,
        }
    });
    serverProcess.stdout?.on('data', (data) => {
        console.log(`[Server] ${data.toString().trim()}`);
    });
    serverProcess.stderr?.on('data', (data) => {
        console.error(`[Server] ${data.toString().trim()}`);
    });
    serverProcess.on('error', (err) => {
        console.error('[Electron] Failed to start backend server:', err);
    });
    serverProcess.on('exit', (code) => {
        console.log(`[Electron] Backend exited with code ${code}`);
        serverProcess = null;
    });
}
function stopBackend() {
    if (serverProcess) {
        serverProcess.kill('SIGTERM');
        serverProcess = null;
    }
}
// --- App Lifecycle ---
electron_1.app.whenReady().then(() => {
    console.log('[Electron] ✅ App is ready');
    console.time('[Electron] Total startup time');
    // Ensure dock is visible on Mac
    if (process.platform === 'darwin') {
        electron_1.app.dock.show();
    }
    console.log('[Electron] Starting backend...');
    console.time('[Electron] Backend startup');
    startBackend();
    console.timeEnd('[Electron] Backend startup');
    console.log('[Electron] Creating main window...');
    console.time('[Electron] Window creation');
    createMainWindow();
    console.timeEnd('[Electron] Window creation');
    console.log('[Electron] Creating tray and menu...');
    createTray();
    createMenu();
    // Global push-to-talk: Cmd+Shift+Space (Mac) / Ctrl+Shift+Space (Win/Linux)
    // Toggle mode: press once to show popup + start recording, press again to stop.
    // (globalShortcut only fires on keydown — no keyup detection, so toggle is the way)
    let isGlobalRecording = false;
    electron_1.globalShortcut.register('CommandOrControl+Shift+Space', () => {
        // Keep dock icon visible on macOS whenever assistant is activated
        if (process.platform === 'darwin')
            electron_1.app.dock.show();
        const sendCommand = (action) => {
            if (assistantWindow && !assistantWindow.isDestroyed()) {
                assistantWindow.webContents.send('global-push-to-talk', action);
            }
        };
        if (!assistantWindow || assistantWindow.isDestroyed()) {
            // Create popup + start recording once ready
            isGlobalRecording = true;
            const win = createAssistantWindow();
            win.once('ready-to-show', () => {
                win.show();
                win.focus();
                sendCommand('start');
            });
        }
        else {
            if (!assistantWindow.isVisible()) {
                assistantWindow.show();
            }
            assistantWindow.focus();
            if (isGlobalRecording) {
                isGlobalRecording = false;
                sendCommand('stop');
            }
            else {
                isGlobalRecording = true;
                sendCommand('start');
            }
        }
    });
    // Reset toggle state when recording finishes (popup tells us via IPC)
    electron_1.ipcMain.on('global-recording-stopped', () => {
        isGlobalRecording = false;
    });
    // ── Auto-updater (checks GitHub Releases) ──
    if (autoUpdater) {
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;
        autoUpdater.on('update-available', (info) => {
            console.log(`[Updater] Update available: v${info.version}`);
            if (mainWindow) {
                mainWindow.webContents.send('update-available', info.version);
            }
        });
        autoUpdater.on('update-downloaded', (info) => {
            console.log(`[Updater] Update downloaded: v${info.version}`);
            const response = electron_1.dialog.showMessageBoxSync(mainWindow, {
                type: 'info',
                title: 'Update Ready',
                message: `Aibō v${info.version} is ready to install.`,
                detail: 'The update will be applied when you restart.',
                buttons: ['Restart Now', 'Later'],
                defaultId: 0,
            });
            if (response === 0) {
                isQuitting = true;
                autoUpdater.quitAndInstall();
            }
        });
        autoUpdater.on('error', (err) => {
            console.warn('[Updater] Auto-update error:', err.message);
        });
        // Check for updates 10s after launch (non-blocking)
        setTimeout(() => autoUpdater.checkForUpdates().catch(() => { }), 10_000);
    }
    console.log('[Electron] ✅ Initialization complete, waiting for window to show...');
    // IPC handlers
    // Allow media permissions (Microphone for Aibo)
    electron_1.session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        if (permission === 'media') {
            return callback(true);
        }
        callback(false);
    });
    electron_1.ipcMain.on('hide-assistant', () => {
        assistantWindow?.hide();
    });
    electron_1.ipcMain.on('toggle-assistant', () => {
        toggleAssistant();
    });
    electron_1.ipcMain.on('window-minimize', () => {
        mainWindow?.minimize();
    });
    electron_1.ipcMain.on('window-maximize', () => {
        if (mainWindow?.isMaximized()) {
            mainWindow.unmaximize();
        }
        else {
            mainWindow?.maximize();
        }
    });
    electron_1.ipcMain.on('window-close', () => {
        if (process.platform === 'darwin') {
            mainWindow?.hide();
        }
        else {
            mainWindow?.close();
        }
    });
    // Assistant window drag — manual implementation for transparent macOS windows
    let dragOffset = { x: 0, y: 0 };
    electron_1.ipcMain.on('assistant-drag-start', (_e, mouseX, mouseY) => {
        if (!assistantWindow)
            return;
        const [winX, winY] = assistantWindow.getPosition();
        dragOffset = { x: mouseX - winX, y: mouseY - winY };
    });
    electron_1.ipcMain.on('assistant-drag-move', (_e, mouseX, mouseY) => {
        if (!assistantWindow)
            return;
        assistantWindow.setPosition(Math.round(mouseX - dragOffset.x), Math.round(mouseY - dragOffset.y));
    });
    // Desktop Notifications
    electron_1.ipcMain.on('show-notification', (_e, title, body) => {
        const notification = new electron_1.Notification({
            title,
            body,
            icon: path_1.default.join(__dirname, '../public/icon.png'),
        });
        notification.on('click', () => {
            mainWindow?.show();
            mainWindow?.focus();
        });
        notification.show();
    });
    electron_1.app.on('activate', () => {
        // macOS: Re-create window when dock icon is clicked and no windows exist
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            startBackend(); // Restart server if it was stopped
            createMainWindow();
        }
    });
});
// before-quit fires on Cmd+Q, tray Quit, or app.quit() — clean up server
electron_1.app.on('before-quit', () => {
    isQuitting = true;
    electron_1.globalShortcut.unregisterAll();
    stopBackend();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform === 'darwin') {
        // macOS: Keep app + server alive (standard macOS behavior)
        // Server continues running so dock-click reopen is instant
        return;
    }
    // Windows/Linux: Quit fully
    stopBackend();
    electron_1.app.quit();
});
