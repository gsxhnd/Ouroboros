// const { contextBridge, ipcRenderer } = require("electron");
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  loadPreferences: () => ipcRenderer.invoke("loadPreferences"),
  copy: ({ from, to }) => ipcRenderer.invoke("copy", from, to),
  useLib: (libPath: string) => ipcRenderer.invoke("useLib", libPath),
  addLibPath: (libPath: string) =>
    ipcRenderer.invoke("dialog:selectLibPath", libPath),
});
