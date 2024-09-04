import os from "os";
import { JSONFilePreset, JSONFile } from "lowdb/node";
import { Low } from "lowdb";
import { userConfigPath, userConfigFile } from "./constants.ts";
import { fileExist, createDir } from "./utils/file.ts";
import { app } from "electron";
import { PreferencesData } from "../ouroboros";

const defaultPreferencesData: PreferencesData = {
  os: os.platform(),
  appConfig: {
    libraries: [],

    useLanguage: "",
  },
};

export class Preferences {
  private db: Low<PreferencesData>;

  constructor() {}

  async init() {
    const exist = await fileExist(userConfigPath);
    if (!exist) {
      await createDir(userConfigPath);
    }
    defaultPreferencesData.appConfig.useLanguage = app.getSystemLocale();

    await JSONFilePreset<PreferencesData>(
      userConfigFile,
      defaultPreferencesData
    )
      .then((db) => {
        this.db = db;
      })
      .catch((err) => {
        console.error(err);
      });
    this.db.write();
  }

  async getPreferences(): Promise<PreferencesData> {
    await this.db.read();
    return this.db.data;
  }

  async setUseLibPath(path: string) {
    for (const i of this.db.data.appConfig.libraries) {
      if ((i.path = path)) {
        i.use = true;
      } else {
        i.use = false;
      }
    }

    if (!this.db.data.appConfig.libraries.filter((i) => i.path === path)) {
      console.log("lib not exist");
      this.db.data.appConfig.libraries.push({
        name: "123",
        path: path,
        use: true,
      });
    }
  }
}

export const preferences = new Preferences();
