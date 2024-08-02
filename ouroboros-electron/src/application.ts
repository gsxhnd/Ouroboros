import { BrowserWindow, ipcMain, session, dialog } from "electron";
import { resolve } from "path";

import { preferences } from "./preferences";
import { isDev, isRelease, userConfigPath } from "./constants";

export class Application {
  private win: BrowserWindow;

  constructor() {}

  async init() {
    this.createWindow();
    await this.loadHtml();
    await this.loadIpc();
  }

  createWindow() {
    if (BrowserWindow.getAllWindows().length === 0) {
      this.win = new BrowserWindow({
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
    }
  }

  async loadHtml() {
    if (isDev) {
      await session.defaultSession.loadExtension(
        resolve("extension/vuetool_6.6.1_0")
      );
      this.win.webContents.openDevTools();
      this.win.loadURL("http://localhost:3000");
    } else {
      this.win.loadFile("dist/renderer/index.html");
    }
  }

  async loadIpc() {
    ipcMain.handle("loadPreferences", async (event) => {
      return await preferences.getPreferences();
    });

    ipcMain.handle("dialog:newAssetLibPath", async (event, libName: string) => {
      const { canceled, filePaths } = await dialog.showOpenDialog(this.win, {
        properties: ["openDirectory", "createDirectory", "promptToCreate"],
      });
      if (canceled) return canceled;
      let newLibPath = resolve(filePaths[0], libName);
      console.log("new lib path:", newLibPath);

      return false;
    });

    ipcMain.handle("dialog:selectAssetLibPath", async (event) => {
      const { canceled, filePaths } = await dialog.showOpenDialog(this.win, {
        properties: ["openDirectory", "createDirectory", "promptToCreate"],
      });
      if (canceled) return null;
      let libPath = filePaths[0];
      console.log("dialog:selectAssetLibPath");
      await preferences.setUseLibPath(libPath);
    });
  }
}

export const application = new Application();
