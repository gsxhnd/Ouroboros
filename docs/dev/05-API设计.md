# 05 - API 设计

## REST API (Axum)

### 资源库

```
POST   /api/library/create          创建资源库
POST   /api/library/open            打开资源库
GET    /api/library/info            获取当前资源库信息
POST   /api/library/close           关闭资源库
```

### 资源

```
GET    /api/assets                  列表（分页、筛选）
GET    /api/assets/:id              详情
PUT    /api/assets/:id              更新元数据（标签、评分、备注）
DELETE /api/assets/:id              删除（从数据库移除，可选删除文件）
GET    /api/assets/:id/thumbnail    获取缩略图
GET    /api/assets/:id/file         获取原始文件
```

### 文件夹

```
GET    /api/folders                 文件夹树
POST   /api/folders                 创建虚拟文件夹
PUT    /api/folders/:id             更新
DELETE /api/folders/:id             删除
POST   /api/folders/:id/assets      添加资源到文件夹
```

### 智能文件夹

```
GET    /api/smart-folders           列表
POST   /api/smart-folders           创建
PUT    /api/smart-folders/:id       更新规则
GET    /api/smart-folders/:id/assets 获取匹配资源
```

### 标签

```
GET    /api/tags                    所有标签（含使用计数）
POST   /api/tags                    创建标签
PUT    /api/tags/:id                更新标签
DELETE /api/tags/:id                删除标签
GET    /api/tags/groups             标签分组
```

### 搜索

```
POST   /api/search                  高级搜索（多条件组合）
GET    /api/search/color            颜色搜索
```

### 系统

```
GET    /api/system/info             系统信息
```

## WebSocket（实时通信）

前端通过 WebSocket 接收服务端推送，替代原 gRPC 流式接口（如资源事件订阅）。

```
WS     /ws/events                   资源变更事件推送（服务端 → 客户端）
```

连接建立后，服务端在文件监听检测到变更时主动推送事件，客户端无需轮询。

## WebSocket 事件格式

```json
{
  "type": "asset.created" | "asset.deleted" | "asset.modified" | "asset.moved",
  "payload": {
    "id": "uuid",
    "file_path": "relative/path/to/file.jpg",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```
