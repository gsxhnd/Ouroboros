import { watch } from "chokidar";
import { db } from "./napi";
import fs, { constants } from "fs/promises";

export class AssetLib {
  private rootPath: string;
  constructor(path: string) {
    this.rootPath = path;
  }

  async init() {
    await fs.access(this.rootPath).then(()=>{})
    await fs.stat(this.rootPath).then((state) => {
      // state.
    });
  }
}
