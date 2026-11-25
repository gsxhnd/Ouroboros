import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// The Go API listens here (`go run ./cmd/ourboros server`); dev and preview
// both forward API traffic to it so the UI never talks to rclone directly.
const apiProxy = {
  "/api": { target: "http://127.0.0.1:8080", changeOrigin: true },
  "/health": { target: "http://127.0.0.1:8080", changeOrigin: true },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
    proxy: apiProxy,
  },
  preview: {
    host: "127.0.0.1",
    port: 1420,
    proxy: apiProxy,
  },
})
