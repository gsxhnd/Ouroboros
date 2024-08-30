/// <reference types="vite/client" />

import { Preferences, Folder, File } from "@/ouroboros";

export interface IElectronAPI {
  loadPreferences: () => Promise<Preferences>;
  newAssetLibPath: (libName: string) => Promise<void>;
  selectAssetLibPath: () => Promise<string>;
  getFolders: () => Promise<Array<Folder>>;
  getFiles: (folderId: number) => Promise<Array<File>>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
