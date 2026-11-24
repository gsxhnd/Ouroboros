import type { HttpMethod } from "@/lib/api"

export type Endpoint = {
  id: string
  group: string
  name: string
  method: HttpMethod
  path: string
  /** 描述文案的语言包 key（api.endpoints.<id>）。 */
  descriptionKey: string
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
    descriptionKey: "api.endpoints.health",
  },
  {
    id: "system-info",
    group: "System",
    name: "System info",
    method: "GET",
    path: "/api/system/info",
    descriptionKey: "api.endpoints.system-info",
  },
  {
    id: "rclone-status",
    group: "rclone",
    name: "rclone status",
    method: "GET",
    path: "/api/rclone/status",
    descriptionKey: "api.endpoints.rclone-status",
  },
  {
    id: "rclone-start",
    group: "rclone",
    name: "Start rclone",
    method: "POST",
    path: "/api/rclone/start",
    descriptionKey: "api.endpoints.rclone-start",
  },
  {
    id: "rclone-stop",
    group: "rclone",
    name: "Stop rclone",
    method: "POST",
    path: "/api/rclone/stop",
    descriptionKey: "api.endpoints.rclone-stop",
  },
  {
    id: "rclone-scan",
    group: "rclone",
    name: "Scan rclone binaries",
    method: "POST",
    path: "/api/rclone/scan",
    descriptionKey: "api.endpoints.rclone-scan",
  },
  {
    id: "rclone-select",
    group: "rclone",
    name: "Select rclone",
    method: "POST",
    path: "/api/rclone/select",
    descriptionKey: "api.endpoints.rclone-select",
    body: json({ source: "system", path: "rclone" }),
  },
  {
    id: "rclone-releases",
    group: "rclone",
    name: "List releases",
    method: "GET",
    path: "/api/rclone/releases",
    descriptionKey: "api.endpoints.rclone-releases",
  },
  {
    id: "rclone-download",
    group: "rclone",
    name: "Start download",
    method: "POST",
    path: "/api/rclone/downloads",
    descriptionKey: "api.endpoints.rclone-download",
    body: json({ version: "v1.74.0" }),
  },
  {
    id: "rclone-download-events",
    group: "rclone",
    name: "Download events",
    method: "GET",
    path: "/api/rclone/downloads/{id}/events",
    descriptionKey: "api.endpoints.rclone-download-events",
    sse: true,
  },
  {
    id: "rclone-download-cancel",
    group: "rclone",
    name: "Cancel download",
    method: "POST",
    path: "/api/rclone/downloads/{id}/cancel",
    descriptionKey: "api.endpoints.rclone-download-cancel",
  },
  {
    id: "rclone-activate",
    group: "rclone",
    name: "Activate version",
    method: "POST",
    path: "/api/rclone/versions/{version}/activate",
    descriptionKey: "api.endpoints.rclone-activate",
  },
  {
    id: "rclone-delete-version",
    group: "rclone",
    name: "Delete version",
    method: "DELETE",
    path: "/api/rclone/versions/{version}",
    descriptionKey: "api.endpoints.rclone-delete-version",
  },
  {
    id: "sync-tasks-list",
    group: "Sync",
    name: "List sync tasks",
    method: "GET",
    path: "/api/sync/tasks",
    descriptionKey: "api.endpoints.sync-tasks-list",
  },
  {
    id: "sync-tasks-create",
    group: "Sync",
    name: "Create sync task",
    method: "POST",
    path: "/api/sync/tasks",
    descriptionKey: "api.endpoints.sync-tasks-create",
    body: json({
      revision: 0,
      name: "backup",
      operation: "sync",
      source: { kind: "local", path: "/tmp/source" },
      target: { kind: "remote", remote: "archive", path: "docs" },
      bw_limit: "10MiB",
      max_transfer: "1GiB",
      enabled: true,
    }),
  },
  {
    id: "sync-tasks-patch",
    group: "Sync",
    name: "Patch sync task",
    method: "PATCH",
    path: "/api/sync/tasks/{id}",
    descriptionKey: "api.endpoints.sync-tasks-patch",
    body: json({
      revision: 0,
      bw_limit: "1M",
      max_transfer: "1GiB",
      enabled: true,
    }),
  },
  {
    id: "sync-tasks-delete",
    group: "Sync",
    name: "Delete sync task",
    method: "DELETE",
    path: "/api/sync/tasks/{id}?revision=0",
    descriptionKey: "api.endpoints.sync-tasks-delete",
  },
  {
    id: "sync-tasks-run",
    group: "Sync",
    name: "Run sync task",
    method: "POST",
    path: "/api/sync/tasks/{id}/run",
    descriptionKey: "api.endpoints.sync-tasks-run",
    body: json({ resync: false }),
  },
  {
    id: "sync-jobs-list",
    group: "Sync",
    name: "List jobs",
    method: "GET",
    path: "/api/sync/jobs",
    descriptionKey: "api.endpoints.sync-jobs-list",
  },
  {
    id: "sync-jobs-stop",
    group: "Sync",
    name: "Stop job",
    method: "POST",
    path: "/api/sync/jobs/{job_id}/stop",
    descriptionKey: "api.endpoints.sync-jobs-stop",
    body: json({}),
  },
  {
    id: "remotes-list",
    group: "Remotes",
    name: "List remotes",
    method: "GET",
    path: "/api/remotes",
    descriptionKey: "api.endpoints.remotes-list",
  },
  {
    id: "remotes-create",
    group: "Remotes",
    name: "Create remote",
    method: "POST",
    path: "/api/remotes",
    descriptionKey: "api.endpoints.remotes-create",
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
    descriptionKey: "api.endpoints.remotes-update",
    body: json({ parameters: { remote: "/tmp" } }),
  },
  {
    id: "remotes-delete",
    group: "Remotes",
    name: "Delete remote",
    method: "DELETE",
    path: "/api/remotes/{name}",
    descriptionKey: "api.endpoints.remotes-delete",
  },
  {
    id: "storage-local-create",
    group: "Storage",
    name: "Create local storage",
    method: "POST",
    path: "/api/workspace/nodes",
    descriptionKey: "api.endpoints.storage-local-create",
    body: json({
      revision: 0,
      kind: "local",
      label: "Backups",
      position: { x: 0, y: 0 },
      local_path: "/tmp/backups",
    }),
  },
  {
    id: "storage-local-delete",
    group: "Storage",
    name: "Delete local storage",
    method: "DELETE",
    path: "/api/workspace/nodes/{id}?revision=0",
    descriptionKey: "api.endpoints.storage-local-delete",
  },
  {
    id: "files-list",
    group: "Files",
    name: "List files",
    method: "GET",
    path: "/api/files?fs=/tmp&remote=",
    descriptionKey: "api.endpoints.files-list",
  },
  {
    id: "files-download",
    group: "Files",
    name: "Download file",
    method: "GET",
    path: "/api/files/download?fs=/tmp&remote=ourboros-demo-file",
    descriptionKey: "api.endpoints.files-download",
  },
  {
    id: "files-mkdir",
    group: "Files",
    name: "Create directory",
    method: "POST",
    path: "/api/files/mkdir",
    descriptionKey: "api.endpoints.files-mkdir",
    body: json({ fs: "/tmp", path: "ourboros-demo" }),
  },
  {
    id: "files-copy",
    group: "Files",
    name: "Copy files",
    method: "POST",
    path: "/api/files/copy",
    descriptionKey: "api.endpoints.files-copy",
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
    descriptionKey: "api.endpoints.files-move",
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
    descriptionKey: "api.endpoints.files-delete",
  },
  {
    id: "sync-events",
    group: "Sync",
    name: "Job events",
    method: "GET",
    path: "/api/sync/jobs/events",
    descriptionKey: "api.endpoints.sync-events",
    sse: true,
  },
  {
    id: "mounts-list",
    group: "Mounts",
    name: "List mounts",
    method: "GET",
    path: "/api/mounts",
    descriptionKey: "api.endpoints.mounts-list",
  },
  {
    id: "mount-events",
    group: "Mounts",
    name: "Mount events",
    method: "GET",
    path: "/api/mounts/events",
    descriptionKey: "api.endpoints.mount-events",
    sse: true,
  },
  {
    id: "mount-start",
    group: "Mounts",
    name: "Start mount",
    method: "POST",
    path: "/api/mounts/{edge_id}/start",
    descriptionKey: "api.endpoints.mount-start",
  },
  {
    id: "mount-stop",
    group: "Mounts",
    name: "Stop mount",
    method: "POST",
    path: "/api/mounts/{edge_id}/stop",
    descriptionKey: "api.endpoints.mount-stop",
  },
  {
    id: "settings-get",
    group: "Settings",
    name: "Get settings",
    method: "GET",
    path: "/api/settings",
    descriptionKey: "api.endpoints.settings-get",
  },
  {
    id: "settings-patch",
    group: "Settings",
    name: "Patch settings",
    method: "PATCH",
    path: "/api/settings",
    descriptionKey: "api.endpoints.settings-patch",
    body: json({ auto_start: true }),
  },
  {
    id: "rc-version",
    group: "RC",
    name: "RC core/version",
    method: "POST",
    path: "/api/rc/core/version",
    descriptionKey: "api.endpoints.rc-version",
    body: json({}),
  },
  {
    id: "rc-listremotes",
    group: "RC",
    name: "RC config/listremotes",
    method: "POST",
    path: "/api/rc/config/listremotes",
    descriptionKey: "api.endpoints.rc-listremotes",
    body: json({}),
  },
  {
    id: "rc-forbidden",
    group: "RC",
    name: "RC config/dump (forbidden)",
    method: "POST",
    path: "/api/rc/config/dump",
    descriptionKey: "api.endpoints.rc-forbidden",
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
