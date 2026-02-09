"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.app.setName('Aibō');
const path_1 = __importDefault(require("path"));
const node_child_process_1 = require("node:child_process");
// import { getVoiceService } from './services/VoiceService'; // REMOVED
// Global references to prevent garbage collection
let mainWindow = null;
let assistantWindow = null;
let tray = null;
let serverProcess = null;
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
    // Disable hardware acceleration to prevent crashes with transparent windows
    electron_1.app.disableHardwareAcceleration();
}
/**
 * Create the "Dashboard" Window (Standard Desktop App)
 */
function createMainWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        titleBarStyle: 'hidden',
        trafficLightPosition: { x: -100, y: -100 }, // Hide native controls (we will use custom CSS ones)
        // titleBarOverlay: false, // We use custom WindowControls in React
        webPreferences: {
            preload: PRELOAD_PATH,
            nodeIntegration: false,
            contextIsolation: true,
        },
        icon: path_1.default.join(__dirname, '../public/icon.png'),
    });
    mainWindow.loadURL(INDEX_URL);
    mainWindow.once('ready-to-show', () => {
        if (process.platform === 'darwin') {
            const iconPath = path_1.default.join(__dirname, '../public/icon.png');
            electron_1.app.dock.setIcon(iconPath);
            electron_1.app.dock.show();
        }
        mainWindow?.show();
        mainWindow?.focus();
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
        frame: false, // No window frame
        transparent: true, // Glass effect
        hasShadow: true, // NATIVE MACOS SHADOW
        resizable: true, // USER REQUEST: Enable Resizing
        minWidth: 300,
        minHeight: 300,
        alwaysOnTop: true,
        show: isDev, // Show immediately in dev to debug
        skipTaskbar: false,
        webPreferences: {
            preload: PRELOAD_PATH,
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    // Ensure it stays on top of EVERYTHING (including full screen apps)
    assistantWindow.setAlwaysOnTop(true, 'screen-saver');
    assistantWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    // USER REQUEST: Lock Aspect Ratio for responsive resizing
    assistantWindow.setAspectRatio(1);
    // Load a specific route for the assistant
    assistantWindow.loadURL(`${INDEX_URL}#/assistant`);
    assistantWindow.once('ready-to-show', () => {
        console.log('[Electron] Assistant window ready-to-show');
        assistantWindow?.show();
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
    const iconPath = path_1.default.join(__dirname, '../public/icon.png'); // dev path
    const icon = electron_1.nativeImage.createFromPath(iconPath).resize({ width: 22, height: 22 });
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
function toggleAssistant() {
    if (!assistantWindow) {
        const win = createAssistantWindow();
        win.once('ready-to-show', () => {
            win.show();
            win.focus();
        });
        return;
    }
    if (assistantWindow.isVisible()) {
        assistantWindow.hide();
    }
    else {
        assistantWindow.show();
        assistantWindow.focus();
    }
}
function startBackend() {
    if (isDev)
        return; // In dev, we use concurrently in package.json
    const serverPath = path_1.default.join(__dirname, '../server/index.js');
    serverProcess = (0, node_child_process_1.spawn)('node', [serverPath], {
        stdio: 'inherit',
        env: { ...process.env, PORT: '3001' }
    });
    serverProcess.on('error', (err) => {
        console.error('Failed to start backend server:', err);
    });
}
function stopBackend() {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
}
// --- App Lifecycle ---
electron_1.app.whenReady().then(() => {
    console.log('[Electron] App is ready');
    // Ensure dock is visible on Mac during development
    if (process.platform === 'darwin') {
        if (isDev) {
            electron_1.app.dock.show();
        }
        else {
            electron_1.app.dock.hide();
        }
    }
    startBackend();
    createMainWindow();
    createAssistantWindow(); // Created but hidden
    createTray();
    createMenu();
    // IPC handlers
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
        mainWindow?.close();
    });
    // Voice Service Integration -- REMOVED PYTHON BRIDGE
    // Transcription is now handled via the Backend API directly from the Frontend.
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createMainWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    stopBackend();
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
