import { memo } from "react"
import type Konva from "konva"
import { Circle, Group, Rect, Text } from "react-konva"

import {
  ACTION_HEIGHT,
  ACTION_WIDTH,
  HEADER_HEIGHT,
  PORT_RADIUS,
  STORAGE_HEIGHT,
  STORAGE_WIDTH,
} from "@/lib/canvas/geometry"
import type { StorageNode } from "@/lib/types"
import type { CanvasPalette } from "@/components/canvas/palette"
import { nodeShapeId } from "@/components/canvas/shape-ids"

export type NodeStatus = "running" | "mounted" | "failed" | "idle"

export type NodeViewProps = {
  node: StorageNode
  selected: boolean
  highlighted: boolean
  status: NodeStatus
  palette: CanvasPalette
  kindLabel: string
  /** 动作节点副标题，例如“复制 · 每天”。 */
  detail: string
  onSelect: (id: string) => void
  onDragMove: (id: string, node: Konva.Node) => void
  onDragEnd: (id: string, position: { x: number; y: number }) => void
  onPortDown: (id: string, side: "in" | "out", node: Konva.Node) => void
  onPortUp: (id: string, side: "in" | "out") => void
  /** 双击节点：打开对应的编辑对话框。 */
  onEdit: (id: string) => void
}

/**
 * 存储节点（本地/远程）与动作节点的统一视图。
 * 所有回调都由父组件提供稳定引用，memo 才能真正阻止无关节点重绘。
 */
export const CanvasNodeView = memo(function CanvasNodeView({
  node,
  selected,
  highlighted,
  status,
  palette,
  kindLabel,
  detail,
  onSelect,
  onDragMove,
  onDragEnd,
  onPortDown,
  onPortUp,
  onEdit,
}: NodeViewProps) {
  const isAction = node.kind === "action"
  const width = isAction ? ACTION_WIDTH : STORAGE_WIDTH
  const height = isAction ? ACTION_HEIGHT : STORAGE_HEIGHT
  const accent = isAction ? palette.actionAccent : palette.storageAccent
  const border =
    selected || highlighted ? palette.nodeSelected : palette.nodeStroke
  const statusColor = statusColorOf(status, palette)
  const portY = HEADER_HEIGHT + (height - HEADER_HEIGHT) / 2

  return (
    <Group
      id={nodeShapeId(node.id)}
      name="node"
      nodeId={node.id}
      x={node.position.x}
      y={node.position.y}
      draggable
      onMouseDown={(event) => {
        event.cancelBubble = true
        onSelect(node.id)
      }}
      onDblClick={(event) => {
        event.cancelBubble = true
        onEdit(node.id)
      }}
      onDragMove={(event) => {
        event.cancelBubble = true
        onDragMove(node.id, event.target)
      }}
      onDragEnd={(event) => {
        event.cancelBubble = true
        onDragEnd(node.id, { x: event.target.x(), y: event.target.y() })
      }}
    >
      <Rect
        width={width}
        height={height}
        cornerRadius={isAction ? 14 : 10}
        fill={palette.nodeFill}
        stroke={border}
        strokeWidth={selected || highlighted ? 2 : 1}
        shadowColor="black"
        shadowBlur={selected ? 12 : 4}
        shadowOpacity={selected ? 0.2 : 0.08}
        shadowOffsetY={2}
      />
      <Rect
        width={width}
        height={HEADER_HEIGHT}
        cornerRadius={[isAction ? 14 : 10, isAction ? 14 : 10, 0, 0]}
        fill={accent}
        listening={false}
      />
      <Text
        x={10}
        y={0}
        width={width - 36}
        height={HEADER_HEIGHT}
        verticalAlign="middle"
        text={kindLabel}
        fontSize={11}
        fontStyle="600"
        fill={palette.headerText}
        ellipsis
        wrap="none"
        listening={false}
      />
      {statusColor ? (
        <Circle
          x={width - 12}
          y={HEADER_HEIGHT / 2}
          radius={4}
          fill={statusColor}
          listening={false}
        />
      ) : null}
      <Text
        x={12}
        y={HEADER_HEIGHT + 10}
        width={width - 24}
        text={node.label}
        fontSize={14}
        fontStyle="600"
        fill={palette.text}
        ellipsis
        wrap="none"
        listening={false}
      />
      <Text
        x={12}
        y={HEADER_HEIGHT + 32}
        width={width - 24}
        text={detail}
        fontSize={11}
        fill={palette.muted}
        ellipsis
        wrap="none"
        listening={false}
      />

      <Port
        x={0}
        y={portY}
        side="in"
        color={palette.port}
        fill={palette.nodeFill}
        onDown={(target) => onPortDown(node.id, "in", target)}
        onUp={() => onPortUp(node.id, "in")}
      />
      <Port
        x={width}
        y={portY}
        side="out"
        color={palette.port}
        fill={palette.port}
        onDown={(target) => onPortDown(node.id, "out", target)}
        onUp={() => onPortUp(node.id, "out")}
      />
    </Group>
  )
})

function Port({
  x,
  y,
  side,
  color,
  fill,
  onDown,
  onUp,
}: {
  x: number
  y: number
  side: "in" | "out"
  color: string
  fill: string
  onDown: (node: Konva.Node) => void
  onUp: () => void
}) {
  return (
    <Circle
      name={`port-${side}`}
      x={x}
      y={y}
      radius={PORT_RADIUS}
      fill={fill}
      stroke={color}
      strokeWidth={2}
      onMouseDown={(event) => {
        event.cancelBubble = true
        onDown(event.target)
      }}
      onMouseUp={(event) => {
        event.cancelBubble = true
        onUp()
      }}
      onMouseEnter={(event) => {
        event.target
          .getStage()
          ?.container()
          .style.setProperty("cursor", "crosshair")
      }}
      onMouseLeave={(event) => {
        event.target.getStage()?.container().style.removeProperty("cursor")
      }}
    />
  )
}

function statusColorOf(status: NodeStatus, palette: CanvasPalette) {
  switch (status) {
    case "running":
      return palette.running
    case "mounted":
      return palette.mounted
    case "failed":
      return palette.failed
    default:
      return null
  }
}
