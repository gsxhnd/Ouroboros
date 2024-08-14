import { build, context } from "esbuild";
// import { wasmPlugin } from "./wasm.plugin.js";
// import watPlugin from "esbuild-plugin-wat";
// console.log(process.env.NODE_ENV);

async function watch() {
  let ctx = await context({
    entryPoints: [
      "./ouroboros-electron/main.ts",
      "./ouroboros-electron/preload.ts",
    ],
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["path", "electron", "fs", "chokidar", "rxjs"],
    outdir: "./dist/",
    minify: false,
    outExtension: {
      ".js": ".cjs",
    },
    loader: {
      ".node": "copy",
      ".wasm": "copy",
    },
  });

  await ctx.watch();
}
watch();
console.log("watch");
