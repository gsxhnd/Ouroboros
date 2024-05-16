export default {
  packagerConfig: {
    asar: false,
    prune: true,
    platform: ["linux"],
    arch: ["x64"],
    ignore: [
      "^/src",
      "^/targe",
      "^/Cargo",
      ".gitignore",
      "forge.config.js",
      "build.main.js",
      "node_modules",
      "yarn.lock",
      "README.md",
    ],
    // ignore: (path) => {
    //   console.log(path);
    // },
  },
};
