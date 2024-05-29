/// <reference types="vite/client" />

import "../ouroboros.d.ts";

export interface IElectronAPI {
  loadPreferences: () => Promise<Preferences>;
  copy: ({ from, to }: { from: string; to: string }) => Promise<void>;
  addLibPath: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
