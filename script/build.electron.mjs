import { build } from "esbuild";
import { wasmPlugin } from "./wasm.plugin.mjs";
import { nativeNodeModulesPlugin } from "./node.plugin.mjs";

// import pkg from "./node.plugin.mjs";
// const { nativeNodeModulesPlugin } = pkg;

console.log(process.env.NODE_ENV);

const opt = () => ({});

build({
  entryPoints: ["./electron/main.ts", "./electron/preload.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["path", "electron", "fs"],
  outdir: "./dist/",
  minify: false,
  // splitting: true,
  // plugins: [nativeNodeModulesPlugin],
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
