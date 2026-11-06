import { memo } from "react"
import { Arrow } from "react-konva"

import type { CanvasPalette } from "@/components/canvas/palette"
import { edgeShapeId } from "@/components/canvas/shape-ids"
import type { ConnectionEdge } from "@/lib/types"

export type EdgeStatus = "running" | "mounted" | "failed" | "idle"

/** 数据流（存储 ↔ 动作）用实线，挂载用虚线，同步关系用细实线。 */
export const CanvasEdgeView = memo(function CanvasEdgeView({
  edge,
  points,
  selected,
  status,
  palette,
  onSelect,
}: {
  edge: ConnectionEdge
  points: number[]
  selected: boolean
  status: EdgeStatus
  palette: CanvasPalette
  onSelect: (id: string) => void
}) {
  const base =
    edge.kind === "mount"
      ? palette.edgeMount
      : edge.kind === "flow"
        ? palette.edgeFlow
        : palette.edgeSync
  const color =
    status === "running"
      ? palette.running
      : status === "mounted"
        ? palette.mounted
        : status === "failed"
          ? palette.failed
          : base
  const disabled = edge.kind === "mount" ? edge.mount?.enabled === false : false
  return (
    <Arrow
      id={edgeShapeId(edge.id)}
      edgeId={edge.id}
      points={points}
      tension={0}
      stroke={selected ? palette.nodeSelected : color}
      fill={selected ? palette.nodeSelected : color}
      strokeWidth={selected ? 3 : 2}
      opacity={disabled ? 0.35 : 1}
      pointerLength={8}
      pointerWidth={7}
      hitStrokeWidth={16}
      dash={edge.kind === "mount" ? [8, 5] : undefined}
      onMouseDown={(event) => {
        event.cancelBubble = true
        onSelect(edge.id)
      }}
    />
  )
})
