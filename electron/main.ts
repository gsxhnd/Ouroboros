import { app, BrowserWindow, ipcMain, session, dialog } from "electron";
import { tray } from "./tray";
import { resolve } from "path";
import { appConfigDB } from "./preferences";
import { IpcMainRegister } from "./ipc";
import { assetLib } from "./assetlib";
import { isDev, isRelease, userConfigPath } from "./constants";

console.log("dev: ", process.env.NODE_ENV);
console.log("path", app.getAppPath());
console.log("userData", app.getPath("userData"));
console.log("appData", app.getPath("appData"));
console.log("exe", app.getPath("exe"));
console.log("user config", userConfigPath);

async function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    minHeight: 600,
    minWidth: 800,
    frame: false,
    titleBarStyle: "hiddenInset",
    titleBarOverlay: true,

    webPreferences: {
      devTools: !isRelease,
      preload: resolve("dist/preload.cjs"),
      navigateOnDragDrop: true,
    },
  });

  if (isDev) {
    await session.defaultSession.loadExtension(
      resolve("extension/vuetool_6.6.1_0")
    );
    win.webContents.openDevTools();
    win.loadURL("http://localhost:3000");
  } else {
    win.loadFile("dist/renderer/index.html");
  }

  const ipc = new IpcMainRegister(win);
  await ipc.register();
}

app.on("ready", async () => {
  console.log("app ready");
  await appConfigDB.init();
  await assetLib.init();
  // let config = await appConfigDB.getPreferences();
  tray();
});

app.whenReady().then(async () => {
  console.log("App is whenready");
  app.on("activate", async () => {
    console.log("activate");
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });

  await createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
