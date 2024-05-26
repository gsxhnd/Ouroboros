import { app, BrowserWindow, ipcMain, session } from "electron";
import { tray } from "./tray";
import { resolve } from "path";
import { JSONFilePreset } from "lowdb/node";
import Database from "libsql";
import { AppConfig } from "./config";

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

const defaultData: AppConfig = {
  libraries: null,
};

// const db2 = new Database("test.db");

async function createDB() {
  const db = await JSONFilePreset<AppConfig>(
    resolve(app.getPath("userData"), "db.json"),
    defaultData
  );
  await db.write().catch((err) => {
    console.error(err);
  });
  await db.read().then(() => {
    console.log(db.data);
  });

  // await db2.exec(
  //   "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)"
  // );
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    minHeight: 600,
    minWidth: 800,
    frame: false,
    titleBarStyle: "hidden",
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

  ipcMain.on("ping", (event) => {
    console.log("pong");
  });
  ipcMain.handle("loadPreferences", (event) => {
    console.log("loadPreferences event", event);
  });
  ipcMain.handle("copy", (event, ...args) => {
    console.log(args[0], args[1]);
    // wasm.copy_async(args[0], args[1]);
  });
}

app.whenReady().then(async () => {
  await createDB();
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
