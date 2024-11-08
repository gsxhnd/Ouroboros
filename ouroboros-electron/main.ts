import { App, app } from "electron";
import { traySetting } from "./tray";
import { preferences } from "./preferences";
import { application } from "./application";
import { Database } from "./sdk";
import logger from "./utils/logger";

// console.log("dev: ", process.env.NODE_ENV);
// console.log("path", app.getAppPath());
// console.log("userData", app.getPath("userData"));
// console.log("appData", app.getPath("appData"));
// console.log("exe", app.getPath("exe"));
// console.log("user config", userConfigPath);
// console.log(add());
app.on("activate", async () => {
  console.log("App on activate");
});

app.on("ready", async () => {
  console.log("App on ready");
  await preferences.init();
  traySetting.init();
  let db = await Database.init("./data/.ouroboros/data.db").catch((error) => {
    logger.error(`init database error: ${error}`);
  });

  // console.log(await db.get());
  // await db
  //   .get()
  //   .then((v: any) => {
  //     console.log("get db data");
  //     console.log(v);
  //   })
  //   .catch((e) => {
  //     console.log(e);
  //   });
});

app.whenReady().then(async () => {
  console.log("App on when ready");
  await application.init();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
