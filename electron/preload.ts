import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    sendMessage: (channel: string, data: unknown) => {
        const validChannels = ['toMain'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    onResponse: (channel: string, func: (...args: unknown[]) => void) => {
        const validChannels = ['fromMain'];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender`
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    hideAssistant: () => ipcRenderer.send('hide-assistant'),
    toggleAssistant: () => ipcRenderer.send('toggle-assistant'),
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    startDrag: (mouseX: number, mouseY: number) => ipcRenderer.send('assistant-drag-start', mouseX, mouseY),
    dragMove: (mouseX: number, mouseY: number) => ipcRenderer.send('assistant-drag-move', mouseX, mouseY),
    showNotification: (title: string, body: string) => ipcRenderer.send('show-notification', title, body),
    onGlobalPushToTalk: (callback: (action: 'start' | 'stop') => void) => {
        ipcRenderer.on('global-push-to-talk', (_event, action: 'start' | 'stop') => callback(action));
    },
    globalRecordingStopped: () => ipcRenderer.send('global-recording-stopped'),
    platform: process.platform,
});
