# Ourboros

Ourboros 是 rclone 的 Web UI：托管或连接 rclone RC，在浏览器里浏览 remote、管理传输。

## 运行

需要本机已安装 [rclone](https://rclone.org/)。

```bash
# 后端（默认 127.0.0.1:8080，并自动拉起 rclone rcd）
cargo run -p ourboros -- server

# 前端开发
cd web
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:1420`（Vite 会把 `/api` 代理到 8080）。

生产环境可同时托管 UI：

```bash
cd web && npm run build
cargo run -p ourboros --release -- server --web-dir ./web/dist
```

## 常用参数

| 参数 | 说明 |
|------|------|
| `--host` / `--port` | HTTP 监听地址，默认 `127.0.0.1:8080` |
| `--web-dir` | 静态 UI 目录；也可用 `OURBOROS_WEB_DIR` |
| `--rclone-bin` | rclone 可执行文件，默认 `rclone` |
| `--rclone-url` | 连接到已有 RC，而不是启动 `rclone rcd` |
| `--rclone-config` | `rclone.conf` 路径 |
| `--no-auto-rclone` | 启动时不自动拉起 / 连接 rclone |

rclone RC 只绑在 `127.0.0.1` 上，由 Ourboros 代理 `/api/rc/*`，浏览器不直接访问 RC。
