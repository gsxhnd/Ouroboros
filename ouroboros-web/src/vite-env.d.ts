/// <reference types="vite/client" />

import "../ouroboros.d.ts";

export interface IElectronAPI {
  loadPreferences: () => Promise<PreferencesData>;
  newAssetLibPath: (libName: string) => Promise<void>;
  selectAssetLibPath: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
