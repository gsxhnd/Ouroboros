import { app, BrowserWindow, ipcMain, session } from "electron";
import { tray } from "./tray";
import { resolve } from "path";
import { JSONFilePreset } from "lowdb/node";
import { Database } from "node-sqlite3-wasm";
import * as wasm from "./pkg";
const isDev: boolean = process.env.NODE_ENV === "dev" && !app.isPackaged;
const isRelease: boolean = app.isPackaged;

console.log("dev: ", process.env.NODE_ENV);
console.log("path", app.getAppPath());
console.log("userData", app.getPath("userData"));
console.log("appData", app.getPath("appData"));
console.log("exe", app.getPath("exe"));
type Data = {
  messages: string[];
};
const defaultData: Data = { messages: [] };

async function createDB() {
  const db = await JSONFilePreset<Data>(
    resolve(app.getPath("userData"), "db.json"),
    defaultData
  );
  await wasm.add_async().then((v) => console.log("async wasm v: ", v));
  console.log(wasm.add(1, 1));
  console.log("before: ", db.data);
  db.data.messages.push("test");
  await db.write();
  console.log("after: ", db.data);

  const sqlite = new Database("database.db");
  // console.log("dbsql: ", sqlite);

  await db.write();
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
