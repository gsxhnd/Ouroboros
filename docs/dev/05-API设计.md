# 05 - API 设计

## 设计原则

- 所有接口以 `/api` 开头；生产环境与 Web 静态资源同源。
- 浏览器调用 typed API，不直接拼接 rclone RC 命令。
- 请求模型区分本地路径、remote 名称和 remote 内路径。
- 所有写操作由服务端校验并返回更新后的资源和 `revision`。
- 长任务使用“当前快照 + SSE 事件流”；客户端断线后先拉快照再重连。
- RC URL、RC 凭据、remote token 和 `config/dump` 永不出现在响应中。

## 通用响应与错误

成功响应直接返回资源、状态或 `{ "data": ... }`，具体格式在实现时保持同一风格。错误统一为：

```json
{
  "error": {
    "code": "workspace_conflict",
    "message": "workspace revision is stale",
    "details": {}
  }
}
```

至少使用以下状态码：

| 状态码 | 场景 |
|--------|------|
| `400` | 参数、路径、cron 或关系配置非法 |
| `404` | 节点、边、任务、remote 或文件不存在 |
| `409` | revision 冲突、重复启动、状态冲突 |
| `502` | rclone/上游操作失败 |
| `503` | rclone 未运行或服务暂不可用 |

## 系统与 rclone 管理

```text
GET    /health
GET    /api/system/info
GET    /api/rclone/status
POST   /api/rclone/start
POST   /api/rclone/stop
POST   /api/rclone/scan
POST   /api/rclone/select
GET    /api/rclone/releases
POST   /api/rclone/downloads
GET    /api/rclone/downloads/{id}/events
POST   /api/rclone/downloads/{id}/cancel
POST   /api/rclone/versions/{version}/activate
DELETE /api/rclone/versions/{version}
```

`GET /api/system/info` 至少返回 Ourboros 版本、HOME 和不含 RC URL 的 rclone 状态：

```json
{
  "name": "ourboros",
  "version": "0.1.0",
  "home_dir": "/Users/example",
  "rclone": {
    "running": true,
    "mode": "spawned",
    "version": "v1.74.0",
    "binary": "rclone"
  }
}
```

## Workspace API

```text
GET    /api/workspace
POST   /api/workspace/nodes
DELETE /api/workspace/nodes/{id}
```

Workspace API 是同步任务的存储层：节点表示端点，sync 边表示同步规则，mount 边表示挂载规则。浏览器 UI 只用上面三个接口管理本地存储节点（存储页）。同步规则的增删改使用同步任务 API，挂载规则的增删改使用挂载任务 API。整体替换（`PUT /api/workspace`）以及边和节点的 PATCH 接口已随画布一起移除。

### WorkspaceDocument

```json
{
  "schema_version": 1,
  "revision": 3,
  "nodes": [
    {
      "id": "node-local-1",
      "kind": "local",
      "label": "备份目录",
      "local_path": "/Users/example/Backups"
    },
    {
      "id": "node-remote-1",
      "kind": "remote",
      "label": "S3 归档",
      "remote": { "name": "archive", "path": "ourboros" }
    }
  ],
  "edges": [
    {
      "id": "edge-sync-1",
      "source": "node-local-1",
      "target": "node-remote-1",
      "kind": "sync",
      "sync": {
        "name": "备份",
        "operation": "sync",
        "bw_limit": "10MiB",
        "max_transfer": "1GiB",
        "schedule": { "mode": "preset", "preset": "daily", "timezone": "Asia/Shanghai", "enabled": true },
        "enabled": true
      }
    }
  ]
}
```

历史文档中的 `position`、`viewport` 字段加载时会被忽略，旧的画布专用数据（action 节点、flow 边）会被清理。服务端拒绝孤儿边、重复挂载、非法路径、不存在 remote、路径穿越以及非法挂载方向。

## Remote 与文件 API

```text
GET    /api/remotes
POST   /api/remotes
GET    /api/remotes/{name}
PATCH  /api/remotes/{name}
DELETE /api/remotes/{name}

GET    /api/files?fs=...&remote=...&path=...
POST   /api/files/mkdir
POST   /api/files/copy
POST   /api/files/move
DELETE /api/files
```

文件请求必须明确 `fs`、`remote` 和相对路径。删除、purge、move 和 `sync` 的请求/响应必须携带可展示的源、目标和破坏性提示。

### 存储 API

存储页把本地目录和 remote 统一为"存储"：

- 本地存储 = workspace 文档中的 local 节点（`POST /api/workspace/nodes` + `DELETE /api/workspace/nodes/{id}`），同步任务按路径自动复用。
- 远程存储 = rclone remote（`POST /api/remotes`、`PATCH /api/remotes/{name}`、`DELETE /api/remotes/{name}`）。
- 删除仍被同步任务/挂载引用的存储端点返回 `409`（`details.kind = "node_in_use"` / `"remote_in_use"`），不允许级联删除用户配置。

## 同步任务 API

```text
GET    /api/sync/tasks
POST   /api/sync/tasks
PATCH  /api/sync/tasks/{id}
DELETE /api/sync/tasks/{id}?revision=N
POST   /api/sync/tasks/{id}/run
GET    /api/sync/jobs
GET    /api/sync/jobs/events
POST   /api/sync/jobs/{job_id}/stop
```

创建任务（`POST /api/sync/tasks`）：

```json
{
  "revision": 3,
  "name": "照片备份",
  "operation": "sync",
  "source": { "kind": "local", "path": "/Users/example/Photos" },
  "target": { "kind": "remote", "remote": "archive", "path": "photos" },
  "bw_limit": "10MiB",
  "max_transfer": "1GiB",
  "schedule": {
    "mode": "preset",
    "preset": "daily",
    "timezone": "Asia/Shanghai",
    "enabled": true
  },
  "enabled": true
}
```

- `operation` 为 `copy | move | sync | bisync`：前三者是单向同步，`bisync` 是双向同步。
- 端点 `kind` 为 `local`（绝对目录）或 `remote`（remote 名 + 可选子路径）。
- `bw_limit` / `max_transfer` 接受单个 rclone 容量字符串（如 `10MiB`、`1.5G`），空或 `off` 表示不限；不接受带宽时间表。
- 响应为 `{ "task": SyncTask, "revision": N }`；`SyncTask` 含服务端计算的 `destructive` 与 `impact`，供 UI 在运行前展示。

`POST /api/sync/tasks/{id}/run` 按任务保存的参数启动 job，可选 body `{"resync": true}`：双向同步首次运行必须带 `resync`，否则返回 `409`（`details.kind = "bisync_resync_required"`）。同一条任务有运行中的 job 时返回 `409`。计划任务不得绕过同样的权限、路径和危险操作校验。

## 挂载 API

```text
GET    /api/mounts/tasks
POST   /api/mounts/tasks
DELETE /api/mounts/tasks/{id}?revision=N
GET    /api/mounts
GET    /api/mounts/events
POST   /api/mounts/{edge_id}/start
POST   /api/mounts/{edge_id}/stop
```

`POST /api/mounts/tasks` 创建一条挂载：源必须是 remote（名称 + 可选子路径），目标必须是本地绝对目录。端点节点由服务端复用或创建。同一本地目录不能挂载两次，活动中的挂载拒绝删除（409）。

只有 `remote -> local` 的 mount 边可以启动。状态至少包含 `starting`、`mounted`、`stopping`、`stopped`、`failed`、退出码和可复制的错误详情；不返回内部命令中的敏感参数。

## 设置 API

```text
GET    /api/settings
PATCH  /api/settings
```

设置只包含 rclone 来源、配置文件路径、自动启动、工作区文件位置等非凭据配置。CLI 参数可以覆盖当前进程，但不隐式写回设置。

## 受限 RC 代理

```text
POST   /api/rc/{*command}
```

rclone RC 一律使用 POST + JSON。代理只允许以下类型命令：

| 命令 | 用途 |
|------|------|
| `core/version` | 就绪探测和版本 |
| `core/stats` | 传输统计 |
| `config/listremotes` | remote 列表 |
| `operations/list` | 列目录 |
| `operations/mkdir` | 创建目录 |
| `operations/deletefile` | 删除文件 |
| `operations/purge` | 删除目录及其内容 |

`config/dump`、任意凭据导出和未在 allowlist 中的命令必须返回 `400`。rclone 未运行时返回 `503`。
