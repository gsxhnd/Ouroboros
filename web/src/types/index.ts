export interface LibraryInfo {
  name: string
  path: string
  version: string
  created_at: string
  is_open: boolean
}

export interface SystemInfo {
  name: string
  version: string
  library_open: boolean
}

export interface ApiError {
  error: string
}

export type WsEventType =
  | "asset.created"
  | "asset.deleted"
  | "asset.modified"
  | "asset.moved"

export interface WsEventPayload {
  id: string
  file_path: string
  timestamp: string
}

export interface WsEvent {
  type: WsEventType
  payload: WsEventPayload
}
