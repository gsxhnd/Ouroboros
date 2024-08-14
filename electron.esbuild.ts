import { build, context, BuildOptions } from "esbuild";
// import { wasmPlugin } from "./wasm.plugin.js";
// import watPlugin from "esbuild-plugin-wat";

let buildOptions: BuildOptions = {
  entryPoints: [
    "./ouroboros-electron/main.ts",
    "./ouroboros-electron/preload.ts",
  ],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["path", "electron", "fs", "chokidar", "rxjs"],
  outdir: "./dist/",
  minify: process.env.NODE_ENV === "prod",
  outExtension: {
    ".js": ".cjs",
  },
  loader: {
    ".node": "copy",
    ".wasm": "copy",
  },
};

const devWatch = async function () {
  let ctx = await context(buildOptions);
  await ctx.watch();
};

console.log(process.env.NODE_ENV);
if (process.env.NODE_ENV === "dev") {
  devWatch();
  console.log("watch");
} else {
  build(buildOptions)
    .then(() => {
      console.log("electron build success");
    })
    .catch((err) => {
      console.error("electron build failed");
      console.error(err);
    });
}
