/// <reference types="vite/client" />

import "../ouroboros.d.ts";

export interface IElectronAPI {
  loadPreferences: () => Promise<Preferences>;
  newAssetLibPath: (libName: string) => Promise<void>;
  selectAssetLibPath: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
