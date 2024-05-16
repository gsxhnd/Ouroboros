import { build } from "esbuild";

build({
  entryPoints: ["./src/main/index.ts"],
  bundle: true,
  minify: true,
  platform: "node",
  format: "esm",
  // outfile: "../dist/main/main.js",
  external: ["path", "electron"],
  outdir: "./dist/main",
});

// build({
//   entryPoints: ["./src/index.ts"],
//   bundle: true,
//   minify: true,
//   platform: "neutral",
//   outfile: "../dist/main.esm.js",
// });
