import { watch } from "chokidar";
import fs, { constants } from "fs/promises";
import { appConfigDB } from "./preferences";
import { resolve } from "path";

export class AssetLib {
  private rootPath: string;
  private configPath: string;
  constructor() {
    this.rootPath = "";
  }

  async init() {
    await appConfigDB.getPreferences().then((config) => {
      console.log(config);
      config.appConfig.libraries.forEach((e) => {
        if (e.use) {
          this.rootPath = e.path;
          this.configPath = resolve(e.path, ".ouroboros");
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
    // const exist = await this.accessLibPath(path);
    // if (!exist) {
    //   return;
    // }
    this.rootPath = path;
  }

  async newLibPath(path: string, libName: string) {}

  async watchLib() {}

  async accessLibPath(event: string, libPath: string) {
    const rootPathExist = await fs
      .access(libPath, constants.F_OK)
      .then(() => true)
      .catch(() => false);
  }
}

export const assetLib = new AssetLib();
