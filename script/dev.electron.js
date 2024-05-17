import { build, context } from "esbuild";

console.log(process.env.NODE_ENV);

async function watch() {
  let ctx = await context({
    minify: false,
    entryPoints: ["./electron/main.ts", "./electron/preload.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    external: ["path", "electron"],
    outdir: "./dist/",
  });

  await ctx.watch();
}
watch();
console.log("watch");
