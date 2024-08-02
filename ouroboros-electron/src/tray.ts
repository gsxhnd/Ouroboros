import { app, Tray, nativeImage, Menu, NativeImage } from "electron";
import { resolve } from "path";

class TraySetting {
  tray?: Tray;
  icon: NativeImage;
  constructor() {
    this.icon = nativeImage.createFromPath(resolve("./resources/tray.png"));
  }

  init() {
    this.tray = new Tray(this.icon);
    this.tray.setToolTip("This is my application");
    this.tray.setTitle("");
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
    this.tray.setContextMenu(contextMenu);
  }
}

export const traySetting = new TraySetting();
