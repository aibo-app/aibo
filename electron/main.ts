import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen, session, type MenuItemConstructorOptions } from 'electron';
app.setName('Aibō');
import path from 'path';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

// import { getVoiceService } from './services/VoiceService'; // REMOVED

// Global references to prevent garbage collection
let mainWindow: BrowserWindow | null = null;
let assistantWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverProcess: ChildProcess | null = null;

const isDev = process.env.NODE_ENV === 'development';
const PRELOAD_PATH = path.join(__dirname, 'preload.js');
const INDEX_URL = isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, '../dist/index.html')}`;

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.show();
    }
  });

  // Disable hardware acceleration to prevent crashes with transparent windows
  app.disableHardwareAcceleration();
}

/**
 * Create the "Dashboard" Window (Standard Desktop App)
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
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
    icon: path.join(__dirname, '../public/icon.png'),
  });

  mainWindow.loadURL(INDEX_URL);

  mainWindow.once('ready-to-show', () => {
    if (process.platform === 'darwin') {
      const iconPath = path.join(__dirname, '../public/icon.png');
      app.dock.setIcon(iconPath);
      app.dock.show();
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
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  // Dimensions for the floating pill
  // ENLARGED: Room for native shadows + diffuse glows
  // REDUCED multiple times as per user requests (600 -> 420 -> 340 -> 260 -> 220)
  // FIXED: Must match or exceed minWidth/minHeight to avoid Electron sizing bugs
  const ASSISTANT_WIDTH = 340;
  const ASSISTANT_HEIGHT = 340;

  // Position at bottom right
  const x = width - ASSISTANT_WIDTH - 20;
  const y = height - ASSISTANT_HEIGHT - 20;

  assistantWindow = new BrowserWindow({
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

  const template: MenuItemConstructorOptions[] = [
    // { role: 'appMenu' }
    ...(isMac
      ? [{
        label: app.name,
        submenu: [
          { role: 'about' as const },
          { type: 'separator' as const },
          { role: 'services' as const },
          { type: 'separator' as const },
          { role: 'hide' as const },
          { role: 'hideOthers' as const },
          { role: 'unhide' as const },
          { type: 'separator' as const },
          { role: 'quit' as const }
        ]
      }]
      : []),
    // { role: 'fileMenu' }
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },
    // { role: 'editMenu' }
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const }
      ]
    },
    // { role: 'viewMenu' }
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Create System Tray Icon
 */
function createTray() {
  const iconPath = path.join(__dirname, '../public/icon.png'); // dev path
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 22, height: 22 });
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Dashboard', click: () => {
        if (mainWindow) mainWindow.show();
        else createMainWindow();
      }
    },
    { label: 'Toggle Assistant', click: toggleAssistant },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
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
  } else {
    assistantWindow.show();
    assistantWindow.focus();
  }
}

function startBackend() {
  if (isDev) return; // In dev, we use concurrently in package.json

  const serverPath = path.join(__dirname, '../server/index.js');
  serverProcess = spawn('node', [serverPath], {
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

app.whenReady().then(() => {
  console.log('[Electron] App is ready');

  // Ensure dock is visible on Mac during development
  if (process.platform === 'darwin') {
    if (isDev) {
      app.dock.show();
    } else {
      app.dock.hide();
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
  session.defaultSession.setPermissionRequestHandler((_webContents: Electron.WebContents, permission: string, callback: (granted: boolean) => void) => {
    if (permission === 'media') {
      return callback(true);
    }
    callback(false);
  });

  ipcMain.on('hide-assistant', () => {
    assistantWindow?.hide();
  });

  ipcMain.on('toggle-assistant', () => {
    toggleAssistant();
  });

  ipcMain.on('window-minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('window-close', () => {
    mainWindow?.close();
  });

  // Voice Service Integration -- REMOVED PYTHON BRIDGE
  // Transcription is now handled via the Backend API directly from the Frontend.

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') app.quit();
});
