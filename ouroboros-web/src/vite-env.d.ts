/// <reference types="vite/client" />

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

