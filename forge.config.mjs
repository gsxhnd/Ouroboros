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
      "doc",
      "node_modules/.vite",
      "node_modules/@babel",
      "node_modules/@electron",
      "node_modules/@electron-forge",
      "node_modules/@esbuild",
      "node_modules/@he-tree",
      "node_modules/@vue",
      "node_modules/@vueuse",
      "node_modules/@volar",
      "node_modules/@tsconfig",
      "node_modules/@rollup",
      "node_modules/@napi-rs",
      "node_modules/@npmcli",
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
