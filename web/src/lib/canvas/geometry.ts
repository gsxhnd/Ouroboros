import type { Position, StorageNode } from "@/lib/types"

/** 存储节点（本地/远程）的固定尺寸。 */
export const STORAGE_WIDTH = 220
export const STORAGE_HEIGHT = 84
/** 动作节点是较小的处理框，只承载操作和计划。 */
export const ACTION_WIDTH = 180
export const ACTION_HEIGHT = 92
export const HEADER_HEIGHT = 28
export const PORT_RADIUS = 6

export type Rect = { x: number; y: number; width: number; height: number }

export function nodeSize(node: StorageNode): { width: number; height: number } {
  return node.kind === "action"
    ? { width: ACTION_WIDTH, height: ACTION_HEIGHT }
    : { width: STORAGE_WIDTH, height: STORAGE_HEIGHT }
}

export function nodeRect(node: StorageNode): Rect {
  return { x: node.position.x, y: node.position.y, ...nodeSize(node) }
}

/** 输入端口位于节点左边缘、标题栏下方的中线。 */
export function inputPort(node: StorageNode): Position {
  const { height } = nodeSize(node)
  return { x: node.position.x, y: node.position.y + HEADER_HEIGHT + (height - HEADER_HEIGHT) / 2 }
}

/** 输出端口位于节点右边缘。 */
export function outputPort(node: StorageNode): Position {
  const { width, height } = nodeSize(node)
  return {
    x: node.position.x + width,
    y: node.position.y + HEADER_HEIGHT + (height - HEADER_HEIGHT) / 2,
  }
}

export function hitNode(nodes: StorageNode[], point: Position): StorageNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const rect = nodeRect(nodes[i])
    if (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    ) {
      return nodes[i]
    }
  }
  return null
}

/**
 * ComfyUI 风格的三次贝塞尔：控制点沿水平方向伸出，
 * 偏移量随两端水平距离变化，保证短距离也有明显弧度。
 */
export function bezierPoints(from: Position, to: Position): number[] {
  const dx = Math.max(Math.abs(to.x - from.x) * 0.5, 60)
  const c1 = { x: from.x + dx, y: from.y }
  const c2 = { x: to.x - dx, y: to.y }
  const points: number[] = []
  const steps = 24
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const mt = 1 - t
    const x =
      mt * mt * mt * from.x +
      3 * mt * mt * t * c1.x +
      3 * mt * t * t * c2.x +
      t * t * t * to.x
    const y =
      mt * mt * mt * from.y +
      3 * mt * mt * t * c1.y +
      3 * mt * t * t * c2.y +
      t * t * t * to.y
    points.push(x, y)
  }
  return points
}

/** 两个节点之间的连线路径：从源输出端口到目标输入端口。 */
export function edgePathPoints(source: StorageNode, target: StorageNode): number[] {
  return bezierPoints(outputPort(source), inputPort(target))
}
