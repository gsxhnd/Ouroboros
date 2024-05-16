import { build, context } from "esbuild";

console.log(process.env.NODE_ENV);

let opt = {
  entryPoints: ["./src/main/main.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["path", "electron"],
  outdir: "./dist/main",
};

async function watch() {
  let ctx = await context({
    minify: false,
    ...opt,
  });
  await ctx.watch();
}

if (process.env.NODE_ENV === "production") {
  build({
    bundle: true,
    ...opt,
  });
} else {
  watch();
}
