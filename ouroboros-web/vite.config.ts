import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

const isDev = process.env.NODE_ENV === "development";
const mode = isDev ? "development" : "production";
console.log(process.env.NODE_ENV);
console.log(mode);

// https://vitejs.dev/config/
export default defineConfig({
  root: "src/",
  base: "./",
  mode: mode,
  server: {
    port: 3000,
  },
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "../dist/renderer",
    sourcemap: isDev,
  },
});
