import { create } from "zustand"
import { persist } from "zustand/middleware"

type Theme = "light" | "dark" | "system"

interface UIStore {
  theme: Theme
  locale: string
  sidebarWidth: number
  inspectorWidth: number
  inspectorVisible: boolean
  setTheme: (theme: Theme) => void
  setLocale: (locale: string) => void
  setSidebarWidth: (width: number) => void
  setInspectorWidth: (width: number) => void
  setInspectorVisible: (visible: boolean) => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      theme: "system",
      locale: "zh",
      sidebarWidth: 240,
      inspectorWidth: 320,
      inspectorVisible: true,
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
      setInspectorWidth: (inspectorWidth) => set({ inspectorWidth }),
      setInspectorVisible: (inspectorVisible) => set({ inspectorVisible }),
    }),
    {
      name: "ourboros-ui",
    },
  ),
)
