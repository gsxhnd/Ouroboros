export type RcloneMode = "spawned" | "attached"

export type RcloneStatus = {
  running: boolean
  mode: RcloneMode | null
  version: string | null
  binary: string
  endpoint?: string | null
  config?: string | null
  os?: string | null
  arch?: string | null
  os_version?: string | null
  go_version?: string | null
  linking?: string | null
  beta?: boolean
}

export type SystemInfo = {
  name?: string
  version?: string
  home_dir?: string
  rclone?: RcloneStatus
}

export type RcloneSourceKind = "system" | "managed" | "custom"

export type ShortcutAction =
  "show_main" | "toggle_panel" | "toggle_rclone" | "quit"

export type SettingsDocument = {
  schema_version: number
  rclone_source: RcloneSourceKind
  rclone_bin: string | null
  rclone_config: string | null
  rclone_rc_url: string | null
  auto_start: boolean
  workspace_path: string | null
  shortcuts: Partial<Record<ShortcutAction, string>>
  updated_at: string
}

export type SettingsPatchBody = {
  rclone_source?: RcloneSourceKind
  rclone_bin?: string | null
  rclone_config?: string | null
  rclone_rc_url?: string | null
  auto_start?: boolean
  workspace_path?: string | null
  shortcuts?: Partial<Record<ShortcutAction, string>>
}

export type RemoteInfo = { name: string; type?: string }

export type RemoteExample = {
  value: string
  help?: string
  provider?: string
}

export type RemoteOption = {
  name: string
  help: string
  type: string
  required: boolean
  advanced: boolean
  password: boolean
  sensitive: boolean
  exclusive: boolean
  default?: string
  provider?: string
  examples?: RemoteExample[]
}

export type RemoteProvider = {
  name: string
  description: string
  prefix: string
  options: RemoteOption[]
}

export type RemoteDetail = {
  name: string
  type: string
  parameters: Record<string, unknown>
}

export type ListItem = {
  name: string | null
  path: string | null
  size: number | null
  mime_type: string | null
  mod_time: string | null
  is_dir: boolean | null
}

export type FilesResponse = {
  fs: string
  remote: string
  items: ListItem[]
}

export type NodeKind = "local" | "remote"

export type RemoteRef = { name: string; path?: string }

export type Position = { x: number; y: number }

export type Viewport = Position & { zoom: number }

export type StorageNode = {
  id: string
  kind: NodeKind
  label: string
  position: Position
  local_path?: string
  remote?: RemoteRef
}

export type SyncOperation = "copy" | "move" | "sync" | "bisync"

export type LastResult = {
  job_id: string
  status: string
  finished_at?: string
  error?: string
}

export type SyncConfig = {
  name?: string
  operation: SyncOperation
  bw_limit?: string
  max_transfer?: string
  enabled: boolean
  schedule?: {
    mode: string
    preset?: string
    cron?: string
    timezone: string
    enabled: boolean
  }
  next_run?: string
  last_result?: LastResult
}

export type MountConfig = { enabled: boolean }

export type EdgeKind = "sync" | "mount"

export type ConnectionEdge = {
  id: string
  source: string
  target: string
  kind: EdgeKind
  sync?: SyncConfig
  mount?: MountConfig
}

export type WorkspaceDocument = {
  schema_version: number
  revision: number
  nodes: StorageNode[]
  edges: ConnectionEdge[]
  viewport: Viewport
  updated_at: string
}

/** 同步任务的端点：本地目录或 remote 内路径。 */
export type TaskEndpoint = {
  kind: "local" | "remote"
  path?: string
  remote?: string
}

/** 同步任务：同步规则的后端只读视图。 */
export type SyncTask = {
  id: string
  name: string
  operation: SyncOperation
  source: TaskEndpoint
  target: TaskEndpoint
  bw_limit?: string
  max_transfer?: string
  schedule?: {
    mode: string
    preset?: string
    cron?: string
    timezone: string
    enabled: boolean
  }
  enabled: boolean
  next_run?: string
  last_result?: LastResult
  destructive: boolean
  impact: string
}

export type JobStatus =
  | "queued"
  | "running"
  | "cancelling"
  | "succeeded"
  | "failed"
  | "partial_failed"
  | "cancelled"
  | "expired"

/** 任务快照里的源/目标端点（paths.Locator 的 JSON 形式）。 */
export type JobLocator = {
  kind: "local" | "remote"
  fs: string
  remote: string
}

export type JobProgress = {
  bytes: number
  transfers: number
  checks: number
  errors: number
  percentage: number
  speed: number
  eta_seconds: number | null
}

export type JobSnapshot = {
  id: string
  edge_id: string
  operation: string
  status: JobStatus
  destructive: boolean
  source: JobLocator
  target: JobLocator
  impact: string
  progress: JobProgress
  error?: string
  started_at: string
  finished_at?: string
}

export type MountStatus =
  "starting" | "mounted" | "stopping" | "stopped" | "failed"

export type MountSnapshot = {
  edge_id: string
  status: MountStatus
  source: string
  target: string
  exit_code?: number
  error?: string
}

export type ApiErrorBody = {
  error?: { code?: string; message?: string; details?: { kind?: string } }
}
