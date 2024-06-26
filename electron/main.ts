import { app, BrowserWindow, ipcMain, session, dialog } from "electron";
import { tray } from "./tray";
import { resolve } from "path";
import { JSONFilePreset } from "lowdb/node";
import Database from "libsql";
import { appDB } from "./preferences";

const isDev: boolean = process.env.NODE_ENV === "dev" && !app.isPackaged;
const isRelease: boolean = app.isPackaged;
const userConfig: string = resolve(
  app.getPath("home"),
  ".config",
  app.getName()
);

console.log("dev: ", process.env.NODE_ENV);
console.log("path", app.getAppPath());
console.log("userData", app.getPath("userData"));
console.log("appData", app.getPath("appData"));
console.log("exe", app.getPath("exe"));
console.log("user config", userConfig);

// const db2 = new Database("test.db");
// let appDB = new AppConfigDB();

app.on("ready", async () => {
  console.log("app ready");
  await appDB.init();
});

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
      // sandbox: false,
      preload: resolve("dist/preload.cjs"),
    },
  });

  if (isDev) {
    await session.defaultSession.loadExtension(
      resolve("extension/vuetool_6.6.1_0")
    );
    win.loadURL("http://localhost:3000");
    win.webContents.openDevTools();
  } else {
    win.loadFile("dist/renderer/index.html");
  }

  ipcMain.handle("loadPreferences", async (event) => {
    console.log("loadPreferences event", event);
    return await appDB.getPreferences();
  });

  ipcMain.handle("dialog:selectLibPath", async () => {
    await dialog
      .showOpenDialog(win, {
        properties: ["openDirectory", "createDirectory", "promptToCreate"],
      })
      .then(({ filePaths }) => {
        console.log(filePaths);
      });
  });

  ipcMain.handle("copy", (event, ...args) => {
    console.log(args[0], args[1]);
  });
}

app.whenReady().then(async () => {
  console.log("app when ready");
  tray();

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
