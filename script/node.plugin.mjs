import path from "path";

export const nativeNodeModulesPlugin = {
  name: "native-node-modules",
  setup(build) {
    // If a ".node" file is imported within a module in the "file" namespace, resolve
    // it to an absolute path and put it into the "node-file" virtual namespace.
    build.onResolve({ filter: /\.node$/, namespace: "file" }, (args) => {
      // console.log("build onResolve starting: " + args.path);
      // console.log(args);
      // console.log(import.meta.resolve(args.path));
      // console.log(import.meta.resolve(args.path, { paths: [args.resolveDir] }));
      // console.log("build onResolve ending: " + args.path);

      return {
        // path: import.meta.resolve(args.path, { paths: [args.resolveDir] }),
        // path: args.path,
        path: path.isAbsolute(args.path)
          ? args.path
          : path.join(args.resolveDir, args.path),
        namespace: "node-file",
      };
    });

    // Files in the "node-file" virtual namespace call "require()" on the
    // path from esbuild of the ".node" file in the output directory.
    build.onLoad({ filter: /.*/, namespace: "node-file" }, (args) => {
      // console.log("build onLoad namespace node-file filter .*");
      // console.log(args);
      return {
        contents: `
          console.log("test")
          try { module.exports = require("${args.path}") }
          catch {}
        `,
      };
    });

    // If a ".node" file is imported within a module in the "node-file" namespace, put
    // it in the "file" namespace where esbuild's default loading behavior will handle
    // it. It is already an absolute path since we resolved it to one above.
    build.onResolve({ filter: /\.node$/, namespace: "node-file" }, (args) => {
      // console.log("build onResolve namespace node-file filter .node");
      // console.log(args);
      return {
        path: args.path,
        namespace: "file",
      };
    });

    // Tell esbuild's default loading behavior to use the "file" loader for
    // these ".node" files.
    let opts = build.initialOptions;
    opts.loader = opts.loader || {};
    opts.loader[".node"] = "file";
  },
};
