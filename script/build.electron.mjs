import { build } from "esbuild";
import { wasmPlugin } from "./wasm.plugin.mjs";
// import { nativeNodeModulesPlugin } from "./node.plugin.mjs";

// import pkg from "./node.plugin.mjs";
// const { nativeNodeModulesPlugin } = pkg;

build({
  entryPoints: ["./electron/main.ts", "./electron/preload.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["path", "electron", "fs", "chokidar"],
  outdir: "./dist/",
  minify: true,
  outExtension: {
    ".js": ".cjs",
  },
  loader: {
    ".node": "copy",
    ".wasm": "copy",
  },
})
  .then(() => {
    console.log("electron build success");
  })
  .catch((err) => {
    console.error("electron build failed");
    console.error(err);
  });
