import { isLocalPath } from "@/lib/paths"
import type { ListItem } from "@/lib/types"

/** 列表项的显示名：优先 name，其次 path，都没有时为空串。 */
export function itemName(item: ListItem): string {
  return item.name ?? item.path ?? ""
}

/** 远程路径的上一级；根目录时返回空串。 */
export function remoteParent(path: string): string {
  const index = path.lastIndexOf("/")
  return index < 0 ? "" : path.slice(0, index)
}

/** 在远程路径下拼接子项；base 为空（remote 根）时直接返回名字。 */
export function joinRemote(base: string, name: string | null): string {
  return base ? `${base}/${name}` : (name ?? "")
}

export type TransferDestination = {
  fs: string
  remote: string | undefined
}

/**
 * 把用户输入的复制/移动目标拆成后端需要的 fs + 路径。
 * 本地绝对路径整体作为 fs；否则第一段是 remote 名，其余是 remote 内路径。
 * 目标是目录时按目录语义落到该路径；是文件时把文件名拼在目标路径后。
 */
export function parseTransferTarget(
  target: string,
  item: { name: string; isDir: boolean }
): TransferDestination {
  if (isLocalPath(target)) {
    return { fs: target, remote: item.isDir ? undefined : item.name }
  }
  const [remote, ...rest] = target.split("/")
  const inner = rest.join("/")
  return {
    fs: remote,
    remote: item.isDir ? inner || undefined : joinRemote(inner, item.name),
  }
}
