/// <reference types="vite/client" />
export interface IElectronAPI {
  loadPreferences: () => Promise<string>;
  copy: ({ from, to }: { from: string; to: string }) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
