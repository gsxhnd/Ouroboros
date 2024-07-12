import { watch } from "chokidar";
import chokidar from "chokidar";

export class Watch {
  private w: chokidar.FSWatcher;
  constructor(rootPath: string) {
    this.w = chokidar.watch(rootPath);
  }

  start() {
    this.w.on("", () => {});
  }
}
