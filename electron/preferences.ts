import "../ouroboros.d.ts";
import os from "os";
import { JSONFilePreset, JSONFile } from "lowdb/node";
import { Low } from "lowdb";
import { resolve } from "path";
import fs, { constants } from "fs/promises";

const defaultData: AppConfig = {
  libraries: [],
};

export class AppConfigDB {
  private configDir: string;
  private configFile: string;
  private db: Low<AppConfig>;

  constructor() {
    console.log(os.homedir());
    this.configDir = resolve(os.homedir(), ".config", "ouroboros");
    this.configFile = resolve(this.configDir, "db.json");
  }

  async init(): Promise<void> {
    await this.existConfigDir().then((exist) => {
      if (!exist) {
        fs.mkdir(this.configDir);
      }
    });
    console.log(this.configFile);

    await JSONFilePreset<AppConfig>(this.configFile, defaultData)
      .then((db) => {
        this.db = db;
      })
      .catch((err) => {
        console.error(err);
      });
    await this.db.write();
  }

  async existConfigDir() {
    return await fs
      .access(this.configDir, constants.F_OK)
      .then(() => true)
      .catch(() => false);
  }

  async addLib(path: string) {
    let data: Libraries = {
      path: path,
      use: false,
    };
    this.db.data.libraries.push(data);
    await this.db.write();
  }

  async getPreferences(): Promise<Preferences> {
    await this.db.read();
    let data: Preferences = {
      os: os.platform(),
      appConfig: this.db.data,
    };
    return data;
  }
}

export const appDB = new AppConfigDB();
