# Ourboros

Ourboros 是 rclone 的 Web UI：托管或连接 rclone RC，在浏览器里浏览 remote、管理传输。服务是一个 Go 进程；桌面端用 Wails 打开同一个 HTTP 服务。

两种运行模式共用一套代码：

- **server 模式**（`cmd/ourboros`）：纯 HTTP 服务，适合浏览器访问与 Docker / NAS 部署，全平台交叉编译（Windows / macOS / Linux，arm64 + amd64）。
- **GUI 模式**（`cmd/desktop`）：Wails 桌面窗口 + 系统托盘，业务仍走同一个 HTTP 服务。

## 开发

工具链：Go 1.26、Node 24（见 `mise.toml`）。

```bash
# 桌面开发（GUI 模式）：Vite HMR + .go 变更自动重建重启
task dev

# 浏览器开发（server 模式）：Go API(8080) + Vite(1420) 并行
task dev:server
```

浏览器开发打开 `http://127.0.0.1:1420`（Vite 会把 `/api` 和 `/health` 代理到 8080）。

只跑 API：

```bash
go run ./cmd/ourboros server
```

生产环境同时托管 UI（开发阶段可以先不构建）：

```bash
cd frontend && npm run build
go run ./cmd/ourboros server --webui ./frontend/dist
```

## Docker（server 模式）

开发环境用 compose 直接跑源码：

```bash
OURBOROS_TOKEN=your-token docker compose -f docker-compose.dev.yml up
```

服务绑定 `0.0.0.0`（端口映射需要），因此必须配置 token：浏览器首次打开时在令牌输入门里粘贴同一个值。宿主机上配合 `task dev:web` 即可在浏览器里开发、后端跑在容器里；容器内没有 rclone 时服务照常启动，rclone 相关操作返回未就绪状态。

发布镜像（构建阶段）：

```bash
docker build -t ourboros .
docker run --rm -p 8080:8080 -e OURBOROS_TOKEN=your-token ourboros
```

## 桌面窗口

桌面壳负责开窗口、系统托盘与应用菜单，业务仍走 HTTP API。macOS 构建需要 Xcode 命令行工具。

```bash
cd frontend && npm run build
go run ./cmd/desktop --webui ./frontend/dist
```

- macOS 上隐藏原生标题栏（保留“红绿灯”按钮），顶部栏可拖动窗口，双击可缩放。
- 点击窗口红色关闭按钮会隐藏到系统托盘，rclone 服务继续在后台运行；托盘左键点击唤回窗口。
- 托盘菜单可以：查看 rclone 状态并启动 / 停止；逐个连接开关挂载（已挂载的打勾）；查看运行中的同步任务并一键停止；切换开机自启动。
- 退出（托盘“退出”、⌘Q、Ctrl+C 或 SIGTERM）会先卸载所有挂载，再停止 rclone，不会留下残留的挂载点或子进程。

Linux 桌面依赖 GTK4 和 WebKitGTK 6.0。Windows 使用 WebView2。

## 常用参数

| 参数 | 说明 |
|------|------|
| `--host` / `--port` | HTTP 监听地址，默认 `127.0.0.1:8080`；非回环地址必须配置 `--auth-token` |
| `--auth-token` | 非回环绑定的访问令牌（env `OURBOROS_TOKEN`）；配置后所有 `/api` 请求需携带 Bearer token |
| `--webui` / `--web-dir` | 静态 UI 目录；也可用 `OURBOROS_WEB_DIR`。显式指定但缺少 `index.html` 时拒绝启动 |
| `--data-dir` | 工作区与设置目录（env `OURBOROS_DATA_DIR`） |
| `--rclone-bin` | rclone 可执行文件，默认 `rclone` |
| `--rclone-url` | 连接到已有 RC，而不是启动 `rclone rcd` |
| `--rclone-config` | `rclone.conf` 路径 |
| `--no-auto-rclone` | 启动时不自动拉起 / 连接 rclone |

rclone RC 只绑在 `127.0.0.1` 上，由 Ourboros 代理 `/api/rc/*`，浏览器不直接访问 RC。token 鉴权是面向开发与可信内网的最小实现，对外发布仍需 TLS。

## 测试

```bash
go test ./internal/... ./cmd/ourboros
cd frontend && npm run typecheck && npm run lint && npm run build
```
