import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import { vite as vidstack } from "vidstack/plugins";
import { visualizer } from "rollup-plugin-visualizer";
var isDev = process.env.NODE_ENV === "development";
var mode = isDev ? "development" : "production";
console.log(process.env.NODE_ENV);
console.log(mode);
// https://vitejs.dev/config/
export default defineConfig({
    base: "./",
    mode: mode,
    server: {
        port: 3000,
        proxy: {
            "/api/v1": "http://localhost:8080",
        },
    },
    plugins: [
        vue({
            template: {
                compilerOptions: {
                    isCustomElement: function (tag) { return tag.startsWith("media-"); },
                },
            },
        }),
        vidstack(),
        visualizer({ open: false }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    build: {
        emptyOutDir: true,
        outDir: "../dist/renderer",
        cssTarget: "chrome61",
        sourcemap: isDev,
    },
});
