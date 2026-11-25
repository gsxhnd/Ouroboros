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
