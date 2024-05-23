/// <reference types="vite/client" />
export interface IElectronAPI {
  loadPreferences: () => Promise<void>;
  copy: ({ from, to }: { from: string; to: string }) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
