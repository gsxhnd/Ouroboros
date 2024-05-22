import { build, context } from "esbuild";
import { wasmPlugin } from "./wasm.plugin.js";

console.log(process.env.NODE_ENV);

build({
  entryPoints: ["./electron/main.ts", "./electron/preload.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["path", "electron", "fs"],
  outdir: "./dist/",
  minify: true,
  plugins: [wasmPlugin],
});
