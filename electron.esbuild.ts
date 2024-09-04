import { build, context, BuildOptions } from "esbuild";

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
  minifyIdentifiers: false,
  loader: {
    ".node": "file",
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
