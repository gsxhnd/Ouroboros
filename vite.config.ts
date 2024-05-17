import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

console.log(process.env.NODE_ENV);
const isDev = process.env.NODE_ENV === "development";

// https://vitejs.dev/config/
export default defineConfig({
  root: "src/",
  base: "./",
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
