import { build, context } from "esbuild";

console.log(process.env.NODE_ENV);

build({
  entryPoints: ["./electron/main.ts", "./electron/preload.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["path", "electron"],
  outdir: "./dist/",
  minify: true,
});
