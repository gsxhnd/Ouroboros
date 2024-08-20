import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  loadPreferences: () => ipcRenderer.invoke("loadPreferences"),
  newAssetLibPath: (libName: string) =>
    ipcRenderer.invoke("dialog:newAssetLibPath", libName),
  selectAssetLibPath: () => ipcRenderer.invoke("dialog:selectAssetLibPath"),
});
