import chokidar from "chokidar";
import fs from "fs";
import { bufferTime, Observable, Subject, filter } from "rxjs";

export interface WatchEvent {
  type: string;
  path: string;
  stats?: fs.Stats;
}

export class Watch {
  private rootPath: string;
  private w?: chokidar.FSWatcher;
  private eventsSubject: Subject<WatchEvent>;

  public events$: Observable<WatchEvent[]>;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.eventsSubject = new Subject<WatchEvent>();
    this.events$ = this.eventsSubject.asObservable().pipe(
      bufferTime(1000),
      filter((events) => events.length > 0)
      // map((events) => {
      //   return events;
      // })
    );
    this.startWatch();
  }

  changeRootPath(path: string) {
    this.w?.close().then(() => {
      this.rootPath = path;
      this.startWatch();
    });
  }

  private startWatch() {
    this.w = chokidar.watch(this.rootPath, {
      ignoreInitial: false,
    });

    this.w
      .on("ready", () => {
        console.log("on ready");
      })
      .on("add", (path: string, stats?: fs.Stats) => {
        this.eventsSubject.next({ type: "add", path, stats });
      })
      .on("addDir", (path: string, stats?: fs.Stats) => {
        this.eventsSubject.next({ type: "addDir", path, stats });
      })
      .on("unlink", (path: string) => {
        this.eventsSubject.next({ type: "unlink", path });
      })
      .on("unlinkDir", (path: string) => {
        this.eventsSubject.next({ type: "unlinkDir", path });
      });
  }
}
