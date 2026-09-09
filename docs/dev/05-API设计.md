# 05 - API 设计

## 系统

```
GET    /health                 健康检查，返回 "ok"
GET    /api/system/info        Ourboros 版本、HOME、rclone 状态
```

`GET /api/system/info` 示例：

```json
{
  "name": "ourboros",
  "version": "0.1.0",
  "home_dir": "/Users/example",
  "rclone": {
    "running": true,
    "mode": "spawned",
    "version": "v1.74.0",
    "binary": "rclone",
    "rc_url": "http://127.0.0.1:54321"
  }
}
```

## rclone 进程

```
GET    /api/rclone/status      当前 RC 连接状态
POST   /api/rclone/start       启动或 attach（已运行则保持）
POST   /api/rclone/stop        停止 Ourboros 拉起的 rclone 子进程
```

## RC 代理

rclone RC **不是 REST**：一律 POST，路径即命令名。

```
POST   /api/rc/{*command}      代理到 rclone RC，JSON body 原样转发
```

常用命令：

| 命令 | 作用 |
|------|------|
| `core/version` | rclone 版本 |
| `core/stats` | 传输统计 |
| `config/listremotes` | remote 列表 |
| `operations/list` | 列目录（`fs`, `remote`） |
| `operations/mkdir` | 创建目录 |
| `operations/deletefile` | 删除文件 |
| `operations/purge` | 删除目录及其内容 |

未运行 rclone 时代理返回 `503`。
