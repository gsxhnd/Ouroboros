import { contextBridge } from "electron/renderer";

contextBridge.exposeInMainWorld("version", {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
});
