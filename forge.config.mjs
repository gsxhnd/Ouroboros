import { MakerZIP } from "@electron-forge/maker-zip";

// ignore = [];

export default {
  packagerConfig: {
    asar: false,
    prune: true,
    platforms: ["drawin", "linux", "windows"],
    arch: ["x64", "arm64"],
    ignore: [
      "^/.cargo",
      "^/.github",
      "^/electron",
      "^/napi",
      "^/script",
      "^/src",
      "^/targe",
      "^/target",
      "^/Cargo",
      "^/extension",
      ".gitignore",
      "tsconfig.json",
      "tsconfig.node.json",
      "vite.config.ts",
      "forge.config.js",
      "build.main.js",
      "yarn.lock",
      "README.md",
      "node_modules/.vite",
    ],
    // extraResource: ["resources/tray.png"],
  },
  makers: [new MakerZIP({}, ["darwin", "linux", "win32"])],
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "gsxhnd",
          name: "ouroboros",
        },
        prerelease: true,
      },
    },
  ],
};
