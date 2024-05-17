const { contextBridge, ipcRenderer } = require("electron");
// import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  loadPreferences: () => ipcRenderer.invoke("loadPreferences"),
});
