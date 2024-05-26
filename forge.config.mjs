console.log("use file");
import { MakerZIP } from "@electron-forge/maker-zip";

// api.package({
//   platform: "drawin",
//   arch: "arm64",
// });

// api.package({
//   platform: "linux",
//   arch: "x64",
// });

// api.make({ platform: "linux" });

export default {
  packagerConfig: {
    asar: false,
    prune: true,
    // all: true,
    platforms: ["drawin", "linux", "windows"],
    arch: ["x64", "arm64"],
    ignore: [
      "^/src",
      "^/targe",
      "^/Cargo",
      "^/electron",
      "^/extension",
      "^/script",
      ".gitignore",
      "tsconfig.json",
      "tsconfig.node.json",
      "vite.config.ts",
      "forge.config.js",
      "build.main.js",
      "node_modules",
      "yarn.lock",
      "README.md",
    ],
    extraResource: ["resources/tray.png"],
    // ignore: (path) => {
    //   console.log(path);
    // },
  },
  makers: [new MakerZIP({}, ["darwin", "linux", "win32"])],
};
