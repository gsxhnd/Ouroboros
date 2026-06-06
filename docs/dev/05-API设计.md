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
WebSocket /ws/events                实时事件推送
```

## gRPC Services (Proto 定义)

```protobuf
service LibraryService {
  rpc Create(CreateLibraryRequest) returns (Library);
  rpc Open(OpenLibraryRequest) returns (Library);
  rpc GetInfo(Empty) returns (Library);
}

service AssetService {
  rpc List(ListAssetsRequest) returns (ListAssetsResponse);
  rpc Get(GetAssetRequest) returns (Asset);
  rpc Update(UpdateAssetRequest) returns (Asset);
  rpc Delete(DeleteAssetRequest) returns (Empty);
  rpc GetThumbnail(GetThumbnailRequest) returns (stream Chunk);
  rpc WatchEvents(Empty) returns (stream AssetEvent);
}

service SearchService {
  rpc Search(SearchRequest) returns (SearchResponse);
  rpc SearchByColor(ColorSearchRequest) returns (SearchResponse);
}

service TagService {
  rpc List(Empty) returns (ListTagsResponse);
  rpc Create(CreateTagRequest) returns (Tag);
  rpc Update(UpdateTagRequest) returns (Tag);
  rpc Delete(DeleteTagRequest) returns (Empty);
}
```

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
