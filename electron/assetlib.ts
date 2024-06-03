import { watch } from "chokidar";
// import { db } from "./napi";
import fs, { constants } from "fs/promises";
import { appConfigDB } from "./preferences";

export class AssetLib {
  private rootPath: string;
  constructor() {
    this.rootPath = "";
  }

  async init() {
    await appConfigDB.getPreferences().then((config) => {
      console.log(config);
      config.appConfig.libraries.forEach((e) => {
        if (e.use) {
          this.rootPath = e.path;
        }
      });
    });

    if (this.rootPath !== "") {
      console.log("starting listen lib path: ", this.rootPath);
      let w = watch(this.rootPath);
      w.on("all", (e, p) => {
        console.log(e + ":  " + p);
      });
    }
  }

  async changeLibPath(path: string) {
    console.log(`change lib path: ${path}`);
    const exist = await this.checkLibPathExist(path);
    if (!exist) {
      return;
    }
    this.rootPath = path;
  }

  async newLibPath(path: string, libName: string) {}

  async checkLibPathExist(libPath: string) {
    return await fs
      .access(libPath, constants.F_OK)
      .then(() => true)
      .catch(() => false);
  }
}

export const assetLib = new AssetLib();
