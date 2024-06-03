import { app } from "electron";
import { resolve } from "path";

export const isDev: Readonly<boolean> =
  process.env.NODE_ENV === "dev" && !app.isPackaged;
export const isRelease: Readonly<boolean> = app.isPackaged;
export const userConfigPath: Readonly<string> = resolve(
  app.getPath("home"),
  ".config",
  app.getName()
);
export const userConfigFile: Readonly<string> = resolve(
  userConfigPath,
  "db.json"
);
