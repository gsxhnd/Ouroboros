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
