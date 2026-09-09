import type { HttpMethod } from "@/lib/api"

export type Endpoint = {
  id: string
  group: string
  name: string
  method: HttpMethod
  path: string
  description: string
  body?: string
  sse?: boolean
}

const json = (value: unknown): string => JSON.stringify(value, null, 2)

export const ENDPOINTS: Endpoint[] = [
  {
    id: "health",
    group: "System",
    name: "Health",
    method: "GET",
    path: "/health",
    description: "进程探活，返回纯文本 ok。",
  },
  {
    id: "system-info",
    group: "System",
    name: "System info",
    method: "GET",
    path: "/api/system/info",
    description: "Ourboros 版本、HOME 和不含 RC URL 的 rclone 状态。",
  },
  {
    id: "rclone-status",
    group: "rclone",
    name: "rclone status",
    method: "GET",
    path: "/api/rclone/status",
    description: "当前 rclone 进程状态。",
  },
  {
    id: "rclone-start",
    group: "rclone",
    name: "Start rclone",
    method: "POST",
    path: "/api/rclone/start",
    description: "启动或连接到 rclone RC。",
  },
  {
    id: "rclone-stop",
    group: "rclone",
    name: "Stop rclone",
    method: "POST",
    path: "/api/rclone/stop",
    description: "停止由 Ourboros 拉起的 rclone。",
  },
  {
    id: "rclone-scan",
    group: "rclone",
    name: "Scan rclone binaries",
    method: "POST",
    path: "/api/rclone/scan",
    description: "扫描系统、自定义和托管 rclone。",
  },
  {
    id: "rclone-select",
    group: "rclone",
    name: "Select rclone",
    method: "POST",
    path: "/api/rclone/select",
    description: "选择本次进程使用的 rclone 来源。",
    body: json({ source: "system", path: "rclone" }),
  },
  {
    id: "rclone-releases",
    group: "rclone",
    name: "List releases",
    method: "GET",
    path: "/api/rclone/releases",
    description: "查询可下载的官方 rclone 版本。",
  },
  {
    id: "rclone-download",
    group: "rclone",
    name: "Start download",
    method: "POST",
    path: "/api/rclone/downloads",
    description: "下载托管 rclone 版本。",
    body: json({ version: "v1.74.0" }),
  },
  {
    id: "rclone-download-events",
    group: "rclone",
    name: "Download events",
    method: "GET",
    path: "/api/rclone/downloads/{id}/events",
    description: "下载进度 SSE。",
    sse: true,
  },
  {
    id: "rclone-download-cancel",
    group: "rclone",
    name: "Cancel download",
    method: "POST",
    path: "/api/rclone/downloads/{id}/cancel",
    description: "取消进行中的下载。",
  },
  {
    id: "rclone-activate",
    group: "rclone",
    name: "Activate version",
    method: "POST",
    path: "/api/rclone/versions/{version}/activate",
    description: "激活已下载的托管版本。",
  },
  {
    id: "rclone-delete-version",
    group: "rclone",
    name: "Delete version",
    method: "DELETE",
    path: "/api/rclone/versions/{version}",
    description: "删除托管 rclone 版本目录。",
  },
  {
    id: "workspace-get",
    group: "Workspace",
    name: "Get workspace",
    method: "GET",
    path: "/api/workspace",
    description: "读取当前 workspace 文档和 revision。",
  },
  {
    id: "workspace-put",
    group: "Workspace",
    name: "Replace workspace",
    method: "PUT",
    path: "/api/workspace",
    description: "整体替换 workspace，必须带期望 revision。",
    body: json({
      revision: 0,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    }),
  },
  {
    id: "workspace-create-node",
    group: "Workspace",
    name: "Create node",
    method: "POST",
    path: "/api/workspace/nodes",
    description: "新增 local 或 remote 节点。",
    body: json({
      revision: 0,
      kind: "local",
      label: "Demo",
      position: { x: 120, y: 80 },
      local_path: "/tmp",
    }),
  },
  {
    id: "workspace-patch-node",
    group: "Workspace",
    name: "Patch node",
    method: "PATCH",
    path: "/api/workspace/nodes/{id}",
    description: "更新节点标签、位置或路径。",
    body: json({ revision: 0, label: "Renamed" }),
  },
  {
    id: "workspace-delete-node",
    group: "Workspace",
    name: "Delete node",
    method: "DELETE",
    path: "/api/workspace/nodes/{id}?revision=0",
    description: "按 revision 删除节点。",
  },
  {
    id: "workspace-create-edge",
    group: "Workspace",
    name: "Create edge",
    method: "POST",
    path: "/api/workspace/edges",
    description: "新增 sync 或 mount 边。",
    body: json({
      revision: 0,
      source: "node-id",
      target: "node-id",
      kind: "sync",
      operation: "copy",
      enabled: true,
    }),
  },
  {
    id: "workspace-patch-edge",
    group: "Workspace",
    name: "Patch edge",
    method: "PATCH",
    path: "/api/workspace/edges/{id}",
    description: "更新边的同步配置。",
    body: json({ revision: 0, enabled: true }),
  },
  {
    id: "workspace-delete-edge",
    group: "Workspace",
    name: "Delete edge",
    method: "DELETE",
    path: "/api/workspace/edges/{id}?revision=0",
    description: "按 revision 删除边。",
  },
  {
    id: "remotes-list",
    group: "Remotes",
    name: "List remotes",
    method: "GET",
    path: "/api/remotes",
    description: "列出 rclone remotes（不含凭据）。",
  },
  {
    id: "remotes-create",
    group: "Remotes",
    name: "Create remote",
    method: "POST",
    path: "/api/remotes",
    description: "创建 remote。alias 示例不会写入真实云凭据。",
    body: json({
      name: "demo-alias",
      type: "alias",
      parameters: { remote: "/tmp" },
    }),
  },
  {
    id: "remotes-update",
    group: "Remotes",
    name: "Update remote",
    method: "PATCH",
    path: "/api/remotes/{name}",
    description: "更新 remote 参数。",
    body: json({ parameters: { remote: "/tmp" } }),
  },
  {
    id: "files-list",
    group: "Files",
    name: "List files",
    method: "GET",
    path: "/api/files?fs=/tmp&remote=",
    description: "列出 fs/remote 下的文件。需要 rclone 已运行。",
  },
  {
    id: "files-mkdir",
    group: "Files",
    name: "Create directory",
    method: "POST",
    path: "/api/files/mkdir",
    description: "创建目录。",
    body: json({ fs: "/tmp", path: "ourboros-demo" }),
  },
  {
    id: "files-copy",
    group: "Files",
    name: "Copy files",
    method: "POST",
    path: "/api/files/copy",
    description: "复制文件或目录。",
    body: json({
      src_fs: "/tmp",
      src_path: "ourboros-demo",
      dst_fs: "/tmp",
      dst_path: "ourboros-demo-copy",
      directory: true,
    }),
  },
  {
    id: "files-move",
    group: "Files",
    name: "Move files",
    method: "POST",
    path: "/api/files/move",
    description: "移动文件或目录。",
    body: json({
      src_fs: "/tmp",
      src_path: "ourboros-demo-copy",
      dst_fs: "/tmp",
      dst_path: "ourboros-demo-moved",
      directory: true,
    }),
  },
  {
    id: "files-delete",
    group: "Files",
    name: "Delete file",
    method: "DELETE",
    path: "/api/files?fs=/tmp&remote=ourboros-demo&purge=true",
    description: "删除文件；purge=true 会删除目录及其内容。",
  },
  {
    id: "sync-run",
    group: "Sync",
    name: "Run sync edge",
    method: "POST",
    path: "/api/sync/{edge_id}/run",
    description: "立刻执行一条 sync 边。",
  },
  {
    id: "sync-jobs",
    group: "Sync",
    name: "List jobs",
    method: "GET",
    path: "/api/sync/jobs",
    description: "当前同步任务快照。",
  },
  {
    id: "sync-events",
    group: "Sync",
    name: "Job events",
    method: "GET",
    path: "/api/sync/jobs/events",
    description: "同步任务 SSE。",
    sse: true,
  },
  {
    id: "sync-stop",
    group: "Sync",
    name: "Stop job",
    method: "POST",
    path: "/api/sync/jobs/{job_id}/stop",
    description: "停止运行中的同步任务。",
  },
  {
    id: "mounts-list",
    group: "Mounts",
    name: "List mounts",
    method: "GET",
    path: "/api/mounts",
    description: "挂载状态快照。",
  },
  {
    id: "mount-events",
    group: "Mounts",
    name: "Mount events",
    method: "GET",
    path: "/api/mounts/events",
    description: "挂载状态 SSE。",
    sse: true,
  },
  {
    id: "mount-start",
    group: "Mounts",
    name: "Start mount",
    method: "POST",
    path: "/api/mounts/{edge_id}/start",
    description: "启动 remote → local 挂载边。",
  },
  {
    id: "mount-stop",
    group: "Mounts",
    name: "Stop mount",
    method: "POST",
    path: "/api/mounts/{edge_id}/stop",
    description: "停止挂载。",
  },
  {
    id: "settings-get",
    group: "Settings",
    name: "Get settings",
    method: "GET",
    path: "/api/settings",
    description: "读取非凭据设置。",
  },
  {
    id: "settings-patch",
    group: "Settings",
    name: "Patch settings",
    method: "PATCH",
    path: "/api/settings",
    description: "更新 rclone 来源、自动启动等设置。",
    body: json({ auto_start: true }),
  },
  {
    id: "rc-version",
    group: "RC",
    name: "RC core/version",
    method: "POST",
    path: "/api/rc/core/version",
    description: "受限 RC 代理。rclone 一律 POST + JSON。",
    body: json({}),
  },
  {
    id: "rc-listremotes",
    group: "RC",
    name: "RC config/listremotes",
    method: "POST",
    path: "/api/rc/config/listremotes",
    description: "允许的 RC 命令示例。",
    body: json({}),
  },
  {
    id: "rc-forbidden",
    group: "RC",
    name: "RC config/dump (forbidden)",
    method: "POST",
    path: "/api/rc/config/dump",
    description: "应返回 400：凭据导出命令被禁止。",
    body: json({}),
  },
]

export function endpointGroups(endpoints: Endpoint[]): string[] {
  const groups: string[] = []
  for (const endpoint of endpoints) {
    if (!groups.includes(endpoint.group)) {
      groups.push(endpoint.group)
    }
  }
  return groups
}

export function filterEndpoints(query: string): Endpoint[] {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return ENDPOINTS
  }
  return ENDPOINTS.filter((endpoint) => {
    return (
      endpoint.name.toLowerCase().includes(needle) ||
      endpoint.path.toLowerCase().includes(needle) ||
      endpoint.method.toLowerCase().includes(needle) ||
      endpoint.group.toLowerCase().includes(needle)
    )
  })
}
