# Ourboros

Ourboros 是 rclone 的 Web UI：托管或连接 rclone RC，在浏览器里浏览 remote、管理传输。服务是一个 Go 进程；桌面端用 Wails 打开同一个 HTTP 服务。

## 运行服务

需要本机已安装 [rclone](https://rclone.org/)，以及 Go 1.26。

```bash
# API（默认 127.0.0.1:8080）
go run ./cmd/ourboros server

# 前端开发
cd web
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:1420`（Vite 会把 `/api` 和 `/health` 代理到 8080）。

生产环境同时托管 UI：

```bash
cd web && npm run build
go run ./cmd/ourboros server --webui ./web/dist
```

## 桌面窗口

桌面壳负责开窗口、系统托盘与应用菜单，业务仍走 HTTP API。macOS 构建需要 Xcode 命令行工具。

```bash
cd web && npm run build
go run ./cmd/desktop --webui ./web/dist
```

- macOS 上隐藏原生标题栏（保留"红绿灯"按钮），顶部栏可拖动窗口，双击可缩放。
- 点击窗口红色关闭按钮会隐藏到系统托盘，rclone 服务继续在后台运行；托盘左键点击唤回窗口。
- 托盘菜单可以：查看 rclone 状态并启动 / 停止；逐个连接开关挂载（已挂载的打勾）；查看运行中的同步任务并一键停止；切换开机自启动。
- 退出（托盘“退出”、⌘Q、Ctrl+C 或 SIGTERM）会先卸载所有挂载，再停止 rclone，不会留下残留的挂载点或子进程。

Linux 桌面依赖 GTK4 和 WebKitGTK 6.0。Windows 使用 WebView2。

## 容器

镜像里只有无界面的服务二进制。当前在实现 HTTP 鉴权之前，服务拒绝绑定非回环地址，所以容器适合本机回环或 host 网络，不适合直接对公网发布。

```bash
docker build -t ourboros .
docker run --rm --network host ourboros
```

## 常用参数

| 参数 | 说明 |
|------|------|
| `--host` / `--port` | HTTP 监听地址，默认 `127.0.0.1:8080` |
| `--webui` / `--web-dir` | 静态 UI 目录；也可用 `OURBOROS_WEB_DIR`。显式指定但缺少 `index.html` 时拒绝启动 |
| `--rclone-bin` | rclone 可执行文件，默认 `rclone` |
| `--rclone-url` | 连接到已有 RC，而不是启动 `rclone rcd` |
| `--rclone-config` | `rclone.conf` 路径 |
| `--no-auto-rclone` | 启动时不自动拉起 / 连接 rclone |

rclone RC 只绑在 `127.0.0.1` 上，由 Ourboros 代理 `/api/rc/*`，浏览器不直接访问 RC。

## 测试

```bash
go test ./internal/... ./cmd/ourboros
```
