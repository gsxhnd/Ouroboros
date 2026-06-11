import type { ApiError, LibraryInfo, SystemInfo } from "@/types"

const DEFAULT_API_BASE = ""

let apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE

export function setApiBaseUrl(url: string) {
  apiBaseUrl = url.replace(/\/$/, "")
}

export function getApiBaseUrl() {
  return apiBaseUrl
}

async function fetchResponse(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  })

  if (!response.ok) {
    let message = response.statusText
    try {
      const body = (await response.json()) as ApiError
      message = body.error
    } catch {
      // ignore parse errors
    }
    throw new Error(message)
  }

  return response
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchResponse(path, init)

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

async function requestText(path: string, init?: RequestInit): Promise<string> {
  const response = await fetchResponse(path, init)
  return (await response.text()).trim()
}

export const http = {
  getHealth: () => requestText("/health"),
  getSystemInfo: () => request<SystemInfo>("/api/system/info"),
  getLibraryInfo: () => request<LibraryInfo>("/api/library/info"),
  createLibrary: (path: string, name: string) =>
    request<LibraryInfo>("/api/library/create", {
      method: "POST",
      body: JSON.stringify({ path, name }),
    }),
  openLibrary: (path: string) =>
    request<LibraryInfo>("/api/library/open", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  closeLibrary: () =>
    request<void>("/api/library/close", {
      method: "POST",
    }),
}

export async function resolveApiBaseUrl() {
  if (import.meta.env.VITE_API_BASE_URL) {
    setApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
  }
  return apiBaseUrl
}
