/// <reference types="vite/client" />

import { Preferences, Folder } from "@type";

export interface IElectronAPI {
  loadPreferences: () => Promise<Preferences>;
  newAssetLibPath: (libName: string) => Promise<void>;
  selectAssetLibPath: () => Promise<string>;
  getFolders: () => Promise<Array<Folder>>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
