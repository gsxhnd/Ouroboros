import { create } from "zustand"

import { getApiBaseUrl, http } from "@/services/http"
import type { LibraryInfo, ServiceStatus, SystemInfo } from "@/types"

interface SystemStore {
  status: ServiceStatus
  systemInfo: SystemInfo | null
  libraryDetail: LibraryInfo | null
  loading: boolean
  error: string | null
  checkedAt: string | null
  refresh: () => Promise<void>
}

async function probeHealth(): Promise<ServiceStatus> {
  try {
    const body = await http.getHealth()
    return body === "ok" ? "online" : "offline"
  } catch {
    return "offline"
  }
}

export const useSystemStore = create<SystemStore>((set) => ({
  status: "unknown",
  systemInfo: null,
  libraryDetail: null,
  loading: false,
  error: null,
  checkedAt: null,

  refresh: async () => {
    set({ loading: true, error: null })

    const status = await probeHealth()
    if (status === "offline") {
      set({
        status,
        systemInfo: null,
        libraryDetail: null,
        loading: false,
        checkedAt: new Date().toISOString(),
        error: getApiBaseUrl()
          ? `Cannot reach service at ${getApiBaseUrl()}`
          : "Cannot reach service",
      })
      return
    }

    try {
      const systemInfo = await http.getSystemInfo()
      let libraryDetail: LibraryInfo | null = null

      if (systemInfo.library_open) {
        try {
          libraryDetail = await http.getLibraryInfo()
        } catch {
          libraryDetail = null
        }
      }

      set({
        status,
        systemInfo,
        libraryDetail,
        loading: false,
        error: null,
        checkedAt: new Date().toISOString(),
      })
    } catch (error) {
      set({
        status: "offline",
        systemInfo: null,
        libraryDetail: null,
        loading: false,
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },
}))
