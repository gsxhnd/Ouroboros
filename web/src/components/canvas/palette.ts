export type CanvasPalette = {
  background: string
  grid: string
  nodeFill: string
  nodeStroke: string
  nodeSelected: string
  text: string
  muted: string
  headerText: string
  storageAccent: string
  actionAccent: string
  port: string
  edgeSync: string
  edgeMount: string
  edgeFlow: string
  pending: string
  running: string
  mounted: string
  failed: string
}

/** ComfyUI 风格：深色底、柔和的网格、按类型区分的标题色。 */
export const DARK_PALETTE: CanvasPalette = {
  background: "#0e0f12",
  grid: "#1c1f26",
  nodeFill: "#1b1d23",
  nodeStroke: "#2c3039",
  nodeSelected: "#7dd3fc",
  text: "#e5e7eb",
  muted: "#8b92a0",
  headerText: "#0b0d10",
  storageAccent: "#60a5fa",
  actionAccent: "#f59e0b",
  port: "#7dd3fc",
  edgeSync: "#64748b",
  edgeMount: "#a78bfa",
  edgeFlow: "#94a3b8",
  pending: "#7dd3fc",
  running: "#34d399",
  mounted: "#a78bfa",
  failed: "#f87171",
}

export const LIGHT_PALETTE: CanvasPalette = {
  background: "#f4f5f7",
  grid: "#e3e6eb",
  nodeFill: "#ffffff",
  nodeStroke: "#d4d8df",
  nodeSelected: "#2563eb",
  text: "#111827",
  muted: "#6b7280",
  headerText: "#ffffff",
  storageAccent: "#3b82f6",
  actionAccent: "#d97706",
  port: "#2563eb",
  edgeSync: "#64748b",
  edgeMount: "#7c3aed",
  edgeFlow: "#64748b",
  pending: "#2563eb",
  running: "#059669",
  mounted: "#7c3aed",
  failed: "#dc2626",
}

export function resolvePalette(theme: string): CanvasPalette {
  if (theme === "light") {
    return LIGHT_PALETTE
  }
  if (theme === "dark") {
    return DARK_PALETTE
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? DARK_PALETTE : LIGHT_PALETTE
}
