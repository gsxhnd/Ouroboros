import type { EdgeKind, StorageNode } from "@/lib/types"

export type ConnectionResult =
  | { ok: true; kind: EdgeKind }
  | { ok: false; reason: "same" | "storageToStorage" | "mountDirection" | "actionToAction" }

/**
 * 画布连线规则（与后端 workspace 校验保持一致）：
 * - 存储 ↔ 动作：数据流边（flow）。
 * - 动作 ↔ 动作：不允许串联。
 * - 存储 → 存储：只允许 remote → local 的挂载；普通复制必须经过动作节点。
 */
export function connectionFor(source: StorageNode, target: StorageNode): ConnectionResult {
  if (source.id === target.id) {
    return { ok: false, reason: "same" }
  }
  const sourceAction = source.kind === "action"
  const targetAction = target.kind === "action"
  if (sourceAction && targetAction) {
    return { ok: false, reason: "actionToAction" }
  }
  if (sourceAction || targetAction) {
    return { ok: true, kind: "flow" }
  }
  if (source.kind === "remote" && target.kind === "local") {
    return { ok: true, kind: "mount" }
  }
  if (source.kind === "local" && target.kind === "remote") {
    return { ok: false, reason: "mountDirection" }
  }
  return { ok: false, reason: "storageToStorage" }
}

export const CONNECTION_MESSAGE: Record<
  Exclude<ConnectionResult, { ok: true; kind: EdgeKind }>["reason"],
  string
> = {
  same: "canvas.rules.same",
  storageToStorage: "canvas.rules.storageToStorage",
  mountDirection: "canvas.rules.mountDirection",
  actionToAction: "canvas.rules.actionToAction",
}
