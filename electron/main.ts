import { app, BrowserWindow, ipcMain, session } from "electron";
import { tray } from "./tray";
import { resolve } from "path";

const dev: boolean = process.env.NODE_ENV === "dev" && !app.isPackaged;
const isRelease: boolean = app.isPackaged;

console.log(process.env.NODE_ENV);
console.log(process.env.NODE_ENV === "dev");
console.log(isRelease);
console.log(dev);
console.log(resolve("dist/preload.js"));
console.log(resolve("./extension/vuetool_6.6.1_0"));

async function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    titleBarStyle: "hiddenInset",
    titleBarOverlay: true,
    webPreferences: {
      devTools: !isRelease,
      // sandbox: false,
      preload: resolve("dist/preload.js"),
    },
  });

  if (dev) {
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
