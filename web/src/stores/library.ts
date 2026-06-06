import { create } from "zustand"
import { persist } from "zustand/middleware"

import { http } from "@/services/http"
import type { LibraryInfo } from "@/types"

interface LibraryStore {
  currentLibrary: LibraryInfo | null
  recentLibraries: LibraryInfo[]
  loading: boolean
  error: string | null
  fetchInfo: () => Promise<void>
  create: (path: string, name: string) => Promise<void>
  open: (path: string) => Promise<void>
  close: () => Promise<void>
}

function rememberLibrary(
  recentLibraries: LibraryInfo[],
  library: LibraryInfo,
): LibraryInfo[] {
  const next = [
    library,
    ...recentLibraries.filter((item) => item.path !== library.path),
  ]
  return next.slice(0, 8)
}

export const useLibraryStore = create<LibraryStore>()(
  persist(
    (set, get) => ({
      currentLibrary: null,
      recentLibraries: [],
      loading: false,
      error: null,

      fetchInfo: async () => {
        set({ loading: true, error: null })
        try {
          const info = await http.getLibraryInfo()
          set({
            currentLibrary: info,
            recentLibraries: rememberLibrary(get().recentLibraries, info),
            loading: false,
          })
        } catch (error) {
          set({
            currentLibrary: null,
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      },

      create: async (path, name) => {
        set({ loading: true, error: null })
        try {
          const info = await http.createLibrary(path, name)
          set({
            currentLibrary: info,
            recentLibraries: rememberLibrary(get().recentLibraries, info),
            loading: false,
          })
        } catch (error) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          })
          throw error
        }
      },

      open: async (path) => {
        set({ loading: true, error: null })
        try {
          const info = await http.openLibrary(path)
          set({
            currentLibrary: info,
            recentLibraries: rememberLibrary(get().recentLibraries, info),
            loading: false,
          })
        } catch (error) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          })
          throw error
        }
      },

      close: async () => {
        set({ loading: true, error: null })
        try {
          await http.closeLibrary()
          set({ currentLibrary: null, loading: false })
        } catch (error) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          })
          throw error
        }
      },
    }),
    {
      name: "ourboros-library",
      partialize: (state) => ({
        recentLibraries: state.recentLibraries,
      }),
    },
  ),
)
