import { build } from "esbuild";
// import { wasmPlugin } from "./wasm.plugin.mjs";

build({
  entryPoints: ["./src/main.ts", "./src/preload.ts"],
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
