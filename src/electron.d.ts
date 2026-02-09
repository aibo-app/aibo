interface ElectronAPI {
  sendMessage: (channel: string, data: unknown) => void;
  onResponse: (channel: string, func: (...args: unknown[]) => void) => void;
  hideAssistant: () => void;
  toggleAssistant: () => void;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  platform: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export { };
