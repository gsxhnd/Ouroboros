import { App, app } from "electron";
import { traySetting } from "./tray";
import { preferences } from "./preferences";
import { application } from "./application";
import { add } from "./napi";

// console.log("dev: ", process.env.NODE_ENV);
// console.log("path", app.getAppPath());
// console.log("userData", app.getPath("userData"));
// console.log("appData", app.getPath("appData"));
// console.log("exe", app.getPath("exe"));
// console.log("user config", userConfigPath);
console.log(add());

app.on("ready", async () => {
  console.log("App on ready");
  await preferences.init();
  traySetting.init();
});

app.on("activate", async () => {
  console.log("App on activate");
});

app.whenReady().then(async () => {
  console.log("App on when ready");
  await application.init();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
