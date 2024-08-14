import { build } from "esbuild";

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
