/** 判断路径是否为 Windows 风格（盘符前缀，或反斜杠且没有正斜杠）。 */
function isWindowsPath(path: string): boolean {
  return /^[A-Za-z]:/.test(path) || (!path.includes("/") && path.includes("\\"))
}

/** Windows 路径用反斜杠拼接，其余按 POSIX 处理。 */
function separatorOf(path: string): string {
  return isWindowsPath(path) ? "\\" : "/"
}

/** 把绝对路径拆成可点击的面包屑段（含各段对应的完整路径）。 */
export function splitPath(path: string): { name: string; path: string }[] {
  const windows = isWindowsPath(path)
  const separator = separatorOf(path)
  const parts = path.split(/[\\/]+/).filter(Boolean)
  const crumbs: { name: string; path: string }[] = []
  if (!windows) {
    crumbs.push({ name: "/", path: "/" })
  }
  let current = ""
  for (const [index, part] of parts.entries()) {
    if (index === 0 && windows) {
      current = `${part}${separator}`
    } else {
      current = `${current.replace(/[\\/]$/, "")}${separator}${part}`
    }
    crumbs.push({ name: part, path: current })
  }
  return crumbs
}

/** 在目录路径下拼接一个子项，沿用该目录已有的分隔符。 */
export function joinPath(base: string, name: string): string {
  const separator = base.includes("\\") && !base.includes("/") ? "\\" : "/"
  return `${base.replace(/[\\/]+$/, "")}${separator}${name}`
}

/** 返回上一级目录；已经在根目录时返回原值。 */
export function parentPath(path: string): string {
  const separator = separatorOf(path)
  const trimmed = path.replace(/[\\/]+$/, "")
  const index = trimmed.lastIndexOf(separator)
  if (index < 0) {
    return path
  }
  return index === 0 ? separator : trimmed.slice(0, index)
}
