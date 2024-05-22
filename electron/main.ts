import { app, BrowserWindow, ipcMain, session } from "electron";
import { tray } from "./tray";
import { resolve } from "path";
import { JSONFilePreset } from "lowdb/node";
import initSqlJs, { InitSqlJsStatic } from "sql.js";
// import {} from ""
// import wasm from "../pkg/wasm_bg.wasm";
// import wasm from "../node_modules/sql.js/dist/sql-wasm.wasm";
// import { readFileSynec } from "fs";
import { readFileSync } from "fs";

const isDev: boolean = process.env.NODE_ENV === "dev" && !app.isPackaged;
const isRelease: boolean = app.isPackaged;
const dbPath = app.getAppPath() + "/db.sqlite";
const dbWasm = app.getAppPath() + "/resources/sql-wasm.wasm";
const dbBuf = readFileSync(dbPath);

console.log("dev: ", process.env.NODE_ENV);
console.log("path", app.getAppPath());
console.log("userData", app.getPath("userData"));
console.log("appData", app.getPath("appData"));
console.log("exe", app.getPath("exe"));
console.log("dbwasm: ", dbWasm);

// console.log(add(1, 2));

async function createDB() {
  // console.log(wasm.add(1, 2));
  const db = await JSONFilePreset(
    resolve(app.getPath("userData"), "db.json"),
    {}
  );
  const dbsql = await initSqlJs({
    locateFile: (filename) => {
      console.log(dbWasm);
      return dbWasm;
    },
  });
  let db02 = new dbsql.Database(dbBuf);
  let res = db02.exec("select * fom test");
  console.log(JSON.stringify(res));
  // let buff = fs.readFileSync("../pkg/wasm_bg.wasm");
  // WebAssembly.instantiate(buff).then((wasm) => {
  //   const { add } = wasm.instance.exports;
  //   console.log(add(1, 1));
  // });
  // wasm.add(1, 1);
  // wasm.add(1, 2);
  // console.log(wasm.add(1, 2))
  // console.log(wasm.add(1, 1));
  // ad
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
      preload: resolve("dist/preload.js"),
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
