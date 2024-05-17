import { app, Tray, nativeImage, Menu } from "electron";
import { resolve } from "path";

export function a(): void {
  console.log("void function a");
}

export function tray(): void {
  const icon = nativeImage.createFromPath(resolve("./resources/tray.png"));
  let tray = new Tray(icon);
  tray.setToolTip("This is my application");
  tray.setTitle("This is my title");
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Quit",
      type: "normal",
      checked: true,
      click: () => {
        console.log("quit click");
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}
