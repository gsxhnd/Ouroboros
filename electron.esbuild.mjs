import { build, context } from "esbuild";
// import { wasmPlugin } from "./wasm.plugin.js";
// import watPlugin from "esbuild-plugin-wat";

async function devWatch() {
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

async function prodBuild(params) {
  build({
    entryPoints: [
      "./ouroboros-electron/main.ts",
      "./ouroboros-electron/preload.ts",
    ],
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["path", "electron", "fs", "chokidar", "rxjs"],
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
}

console.log(process.env.NODE_ENV);
if (process.env.NODE_ENV === "dev") {
  devWatch();
  console.log("watch");
} else {
  prodBuild();
}
