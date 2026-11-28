export function formatBytes(bytes: number | null): string {
  if (bytes === null || Number.isNaN(bytes)) {
    return "—"
  }
  if (bytes < 1024) {
    return `${bytes} B`
  }
  const units = ["KB", "MB", "GB", "TB", "PB"]
  let value = bytes
  let unit = "B"
  for (const next of units) {
    if (value < 1024) {
      break
    }
    value /= 1024
    unit = next
  }
  return `${value.toFixed(1)} ${unit}`
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) {
    return "—"
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toLocaleString()
}

/** 把毫秒时长渲染为 45s / 3m 12s / 1h 05m 的紧凑形式。 */
export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) {
    return "—"
  }
  const total = Math.floor(ms / 1000)
  if (total < 60) {
    return `${total}s`
  }
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  if (minutes < 60) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`
  }
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`
}

/** 一次执行的耗时：结束时间缺失（进行中/中断）时返回占位符。 */
export function runDuration(startedAt: string, finishedAt?: string): string {
  if (!startedAt || !finishedAt) {
    return "—"
  }
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  return formatDuration(ms)
}
