import "../ouroboros.d.ts";
import os from "os";
import { JSONFilePreset, JSONFile } from "lowdb/node";
import { Low } from "lowdb";
import fs, { constants } from "fs/promises";
import { userConfigPath, userConfigFile } from "./constants.ts";

const defaultData: AppConfig = {
  libraries: [],
};

export class AppConfigDB {
  private db: Low<AppConfig>;

  constructor() {}

  async init(): Promise<void> {
    await this.existConfigDir().then((exist) => {
      if (!exist) {
        fs.mkdir(userConfigPath);
      }
    });
    console.log(userConfigFile);

    await JSONFilePreset<AppConfig>(userConfigFile, defaultData)
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
      .access(userConfigPath, constants.F_OK)
      .then(() => true)
      .catch(() => false);
  }

  async addNewLib(path: string) {
    let data: Libraries = {
      path: path,
      use: true,
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

export const appConfigDB = new AppConfigDB();
