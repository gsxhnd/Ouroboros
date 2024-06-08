import { BrowserWindow, ipcMain, dialog } from "electron";
import { appConfigDB } from "./preferences";
import { assetLib } from "./assetlib";
import { resolve } from "path";

export class IpcMainRegister {
  private win: BrowserWindow;
  constructor(win: BrowserWindow) {
    this.win = win;
  }

  async register() {
    ipcMain.handle("loadPreferences", async (event) => {
      console.log("loadPreferences event", event);
      return await appConfigDB.getPreferences();
    });

    ipcMain.handle("dialog:newAssetLibPath", async (event, libName: string) => {
      const { canceled, filePaths } = await dialog.showOpenDialog(this.win, {
        properties: ["openDirectory", "createDirectory", "promptToCreate"],
      });
      if (canceled) return canceled;
      let libPath = resolve(filePaths[0], libName);

      await appConfigDB.addNewLib(libPath).catch((err) => {
        throw err;
      });

      await assetLib.newLibPath(filePaths[0], libName).catch((err) => {
        throw err;
      });

      return false;
    });

    ipcMain.handle("dialog:selectAssetLibPath", async (event) => {
      return await dialog
        .showOpenDialog(this.win, {
          properties: ["openDirectory", "createDirectory", "promptToCreate"],
        })
        .then(({ canceled, filePaths }) => {
          if (canceled) return null;
          return filePaths[0];
        });
    });
  }
}
