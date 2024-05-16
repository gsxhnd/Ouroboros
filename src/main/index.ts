// const { app, BrowserWindow } = require("electron");
import { app, BrowserWindow } from "electron";
import { resolve } from "path";

import { a } from "./a";

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      devTools: true,
    },
  });
  console.log(resolve());
  a();
  win.loadFile("dist/renderer/index.html");
  win.webContents.openDevTools();
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

// window.addEventListener("DOMContentLoaded", () => {
//   const replaceText = (selector, text) => {
//     const element = document.getElementById(selector);
//     if (element) element.innerText = text;
//   };

//   for (const dependency of ["chrome", "node", "electron"]) {
//     replaceText(`${dependency}-version`, process.versions[dependency]);
//   }
// });
