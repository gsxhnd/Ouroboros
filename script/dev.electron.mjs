import { build, context } from "esbuild";
import { wasmPlugin } from "./wasm.plugin.js";
// import watPlugin from "esbuild-plugin-wat";
console.log(process.env.NODE_ENV);

async function watch() {
  let ctx = await context({
    minify: false,
    entryPoints: ["./electron/main.ts", "./electron/preload.ts"],
    bundle: true,
    platform: "node",
    format: "iife",
    external: ["path", "electron", "fs"],
    outdir: "./dist/",
    plugins: [],
  });

  await ctx.watch();
}
watch();
console.log("watch");
