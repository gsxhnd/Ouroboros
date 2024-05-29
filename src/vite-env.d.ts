/// <reference types="vite/client" />
export interface IElectronAPI {
  loadPreferences: () => Promise<Preference>;
  copy: ({ from, to }: { from: string; to: string }) => Promise<void>;
}

interface Preference {
  os: string;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
