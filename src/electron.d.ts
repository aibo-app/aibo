interface ElectronAPI {
  sendMessage: (channel: string, data: unknown) => void;
  onResponse: (channel: string, func: (...args: unknown[]) => void) => void;
  hideAssistant: () => void;
  toggleAssistant: () => void;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  startDrag: (mouseX: number, mouseY: number) => void;
  dragMove: (mouseX: number, mouseY: number) => void;
  showNotification: (title: string, body: string) => void;
  onGlobalPushToTalk: (callback: (action: 'start' | 'stop') => void) => void;
  globalRecordingStopped: () => void;
  platform: 'darwin' | 'win32' | 'linux';
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export { };
