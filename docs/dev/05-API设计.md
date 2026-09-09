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
PUT    /api/workspace
POST   /api/workspace/nodes
PATCH  /api/workspace/nodes/{id}
DELETE /api/workspace/nodes/{id}
POST   /api/workspace/edges
PATCH  /api/workspace/edges/{id}
DELETE /api/workspace/edges/{id}
```

`GET /api/workspace` 返回当前 `WorkspaceDocument` 和 `revision`。普通画布编辑使用节点/边资源接口；`PUT /api/workspace` 用于整体替换、导入和恢复，必须提交期望的 `revision`。

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
      "position": { "x": 120, "y": 160 },
      "local_path": "/Users/example/Backups"
    },
    {
      "id": "node-remote-1",
      "kind": "remote",
      "label": "S3 归档",
      "position": { "x": 520, "y": 160 },
      "remote": { "name": "archive", "path": "ourboros" }
    }
  ],
  "edges": [],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

服务端拒绝孤儿边、重复边、非法路径、不存在 remote、路径穿越以及非法挂载方向。

## Remote 与文件 API

```text
GET    /api/remotes
POST   /api/remotes
PATCH  /api/remotes/{name}

GET    /api/files?fs=...&remote=...&path=...
POST   /api/files/mkdir
POST   /api/files/copy
POST   /api/files/move
DELETE /api/files
```

文件请求必须明确 `fs`、`remote` 和相对路径。删除、purge、move 和 `sync` 的请求/响应必须携带可展示的源、目标和破坏性提示。

## 同步任务 API

```text
POST   /api/sync/{edge_id}/run
GET    /api/sync/jobs
GET    /api/sync/jobs/events
POST   /api/sync/jobs/{job_id}/stop
```

同步边在建线时保存：

```json
{
  "operation": "copy | move | sync",
  "schedule": {
    "mode": "preset | cron",
    "preset": "hourly | daily | weekly",
    "cron": "0 */6 * * *",
    "timezone": "Asia/Shanghai",
    "enabled": true
  },
  "enabled": true
}
```

`POST /api/sync/{edge_id}/run` 返回 job 快照；同一边有运行中的 job 时返回 `409`。计划任务不得绕过同样的权限、路径和危险操作校验。

## 挂载 API

```text
GET    /api/mounts
GET    /api/mounts/events
POST   /api/mounts/{edge_id}/start
POST   /api/mounts/{edge_id}/stop
```

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
