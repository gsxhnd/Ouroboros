import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const workspaceRoot = path.resolve(__dirname, "..")

// https://vite.dev/config/
export default defineConfig({
  // Keep optimize cache alongside hoisted workspace deps to avoid 504 Outdated Optimize Dep.
  cacheDir: path.join(workspaceRoot, "node_modules/.vite/web"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router",
      "zustand",
      "zustand/middleware",
      "i18next",
      "react-i18next",
      "@tanstack/react-query",
    ],
  },
  server: {
    port: 1420,
    strictPort: true,
    fs: {
      allow: [workspaceRoot],
    },
    proxy: {
      "/api": "http://127.0.0.1:8080",
      "/health": "http://127.0.0.1:8080",
    },
  },
})
