import { app, BrowserWindow, BaseWindow, ipcMain } from "electron";
import { contextBridge } from "electron/renderer";
// import { resolve } from "path";

// import { a } from "./a";

const dev: boolean = process.env.NODE_ENV === "dev" && !app.isPackaged;
const isRelease: boolean = app.isPackaged;

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    titleBarStyle: "hidden",
    titleBarOverlay: true,
    webPreferences: {
      devTools: !isRelease,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const { width, height } = win.getContentBounds();
  console.log(width, height);
  console.log(win.getContentSize());
  console.log(win.getContentView());
  // console.log(win.getNativeWindowHandle());

  if (dev) {
    win.loadURL("http://localhost:3000");
    win.webContents.openDevTools();
  } else {
    win.loadFile("dist/renderer/index.html");
  }

  ipcMain.on("ping", (event) => {
    console.log("pong");
  });
};

app.whenReady().then(() => {
  console.log("ready");
  app.on("activate", () => {
    console.log("activate");
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
