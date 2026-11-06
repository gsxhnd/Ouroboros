import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type Konva from "konva"
import { Arrow, Layer, Rect, Shape, Stage } from "react-konva"

import {
  CanvasContextMenu,
  type ContextMenuItem,
} from "@/components/canvas/context-menu"
import {
  CanvasEdgeView,
  type EdgeStatus,
} from "@/components/canvas/canvas-edges"
import {
  CanvasNodeView,
  type NodeStatus,
} from "@/components/canvas/canvas-nodes"
import { edgeShapeId } from "@/components/canvas/shape-ids"
import { resolvePalette, type CanvasPalette } from "@/components/canvas/palette"
import { useTheme } from "@/components/theme-provider"
import {
  bezierPoints,
  edgePathPoints,
  inputPort,
  nodeRect,
  outputPort,
} from "@/lib/canvas/geometry"
import { useLatest } from "@/lib/canvas/use-latest"
import type {
  ConnectionEdge,
  Position,
  StorageNode,
  Viewport,
} from "@/lib/types"

const MIN_ZOOM = 0.2
const MAX_ZOOM = 3
/** 滚轮停止多久后才把视口写回 store；滚动期间不触发 React 渲染。 */
const VIEWPORT_COMMIT_DELAY = 250

export type CanvasSelection =
  { type: "node"; id: string } | { type: "edge"; id: string } | null

export type CanvasLabels = {
  ariaLabel: string
  empty: string
  storage: string
  sync: string
}

export type MenuContext =
  | { kind: "canvas"; world: Position }
  | { kind: "node"; id: string; world: Position }
  | { kind: "edge"; id: string; world: Position }

type CanvasWorkspaceProps = {
  nodes: StorageNode[]
  edges: ConnectionEdge[]
  viewport: Viewport
  selection: CanvasSelection
  labels: CanvasLabels
  nodeStatus: (id: string) => NodeStatus
  edgeStatus: (id: string) => EdgeStatus
  nodeDetail: (node: StorageNode) => string
  onSelect: (selection: CanvasSelection) => void
  onNodeMove: (id: string, position: Position) => void
  onViewportChange: (viewport: Viewport) => void
  onConnect: (source: string, target: string) => void
  onDeleteSelection: () => void
  buildMenu: (context: MenuContext) => ContextMenuItem[]
}

type Drag = {
  kind: "connect"
  from: string
  side: "in" | "out"
  hover: string | null
} | null

export function CanvasWorkspace({
  nodes,
  edges,
  viewport,
  selection,
  labels,
  nodeStatus,
  edgeStatus,
  nodeDetail,
  onSelect,
  onNodeMove,
  onViewportChange,
  onConnect,
  onDeleteSelection,
  buildMenu,
}: CanvasWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const layerRef = useRef<Konva.Layer>(null)
  const tempRef = useRef<Konva.Arrow>(null)
  const dragRef = useRef<Drag>(null)
  const wheelTimer = useRef<number | null>(null)
  const { theme } = useTheme()
  const palette = resolvePalette(theme)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [menu, setMenu] = useState<{
    x: number
    y: number
    context: MenuContext
  } | null>(null)
  const [hoverTarget, setHoverTarget] = useState<string | null>(null)

  const index = useMemo(() => {
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const edgesByNode = new Map<string, ConnectionEdge[]>()
    for (const edge of edges) {
      for (const id of [edge.source, edge.target]) {
        const list = edgesByNode.get(id) ?? []
        list.push(edge)
        edgesByNode.set(id, list)
      }
    }
    return { byId, edgesByNode }
  }, [nodes, edges])

  const edgeGeometry = useMemo(() => {
    const geometry = new Map<string, number[]>()
    for (const edge of edges) {
      const source = index.byId.get(edge.source)
      const target = index.byId.get(edge.target)
      if (source && target) {
        geometry.set(edge.id, edgePathPoints(source, target))
      }
    }
    return geometry
  }, [edges, index])
  const nodeBounds = useMemo(
    () => nodes.map((node) => ({ node, rect: nodeRect(node) })),
    [nodes]
  )

  // 事件回调通过 latest ref 读取最新数据，回调本身引用稳定，memo 节点不会因此重绘。
  const latest = useLatest({
    nodes,
    edges,
    index,
    nodeBounds,
    viewport,
    onNodeMove,
    onViewportChange,
    onConnect,
    onSelect,
    onDeleteSelection,
    selection,
    buildMenu,
  })

  useEffect(() => {
    const element = containerRef.current
    if (!element) {
      return
    }
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") {
        return
      }
      const target = event.target as HTMLElement | null
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return
      }
      if (latest.current.selection) {
        event.preventDefault()
        latest.current.onDeleteSelection()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [latest])

  useEffect(() => {
    return () => {
      if (wheelTimer.current) {
        window.clearTimeout(wheelTimer.current)
      }
    }
  }, [])

  // 视口由 Konva 直接变换；React 的 viewport 只在外部变化（如"重置视图"）时同步回 Stage。
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) {
      return
    }
    if (
      stage.x() !== viewport.x ||
      stage.y() !== viewport.y ||
      stage.scaleX() !== viewport.zoom
    ) {
      stage.position({ x: viewport.x, y: viewport.y })
      stage.scale({ x: viewport.zoom, y: viewport.zoom })
      stage.batchDraw()
    }
  }, [viewport])

  const scheduleViewportCommit = useCallback(() => {
    if (wheelTimer.current) {
      window.clearTimeout(wheelTimer.current)
    }
    wheelTimer.current = window.setTimeout(() => {
      const stage = stageRef.current
      if (!stage) {
        return
      }
      latest.current.onViewportChange({
        x: stage.x(),
        y: stage.y(),
        zoom: stage.scaleX(),
      })
    }, VIEWPORT_COMMIT_DELAY)
  }, [latest])

  /** 指针在世界坐标系中的位置（即节点 position 的坐标系）。 */
  const worldPointer = (): Position | null => {
    return layerRef.current?.getRelativePointerPosition() ?? null
  }

  /** 拖动节点时实时更新与之相连的边，避免走 React 渲染。 */
  const refreshEdgesOf = (movingId: string, moving: Position) => {
    const stage = stageRef.current
    if (!stage) {
      return
    }
    const { byId, edgesByNode } = latest.current.index
    const position = (node: StorageNode) =>
      node.id === movingId ? moving : node.position
    for (const edge of edgesByNode.get(movingId) ?? []) {
      const source = byId.get(edge.source)
      const target = byId.get(edge.target)
      if (!source || !target) {
        continue
      }
      const shape = stage.findOne<Konva.Arrow>(`#${edgeShapeId(edge.id)}`)
      if (shape) {
        shape.points(
          bezierPoints(
            outputOf(source, position(source)),
            inputOf(target, position(target))
          )
        )
      }
    }
  }

  const handleNodeDragMove = useCallback(
    (id: string, shape: Konva.Node) => {
      refreshEdgesOf(id, { x: shape.x(), y: shape.y() })
      stageRef.current?.batchDraw()
    },
    // refreshEdgesOf 只读取 latest ref，因此无需作为依赖。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [latest]
  )

  const handleNodeDragEnd = useCallback(
    (id: string, position: Position) => {
      latest.current.onNodeMove(id, position)
    },
    [latest]
  )

  const handleSelectNode = useCallback(
    (id: string) => {
      latest.current.onSelect({ type: "node", id })
    },
    [latest]
  )

  const handleSelectEdge = useCallback(
    (id: string) => {
      latest.current.onSelect({ type: "edge", id })
    },
    [latest]
  )

  const handlePortDown = useCallback(
    (id: string, side: "in" | "out", shape: Konva.Node) => {
      const layer = layerRef.current
      if (!layer) {
        return
      }
      dragRef.current = { kind: "connect", from: id, side, hover: null }
      setHoverTarget(null)
      const start = shape.getAbsolutePosition(layer)
      const world = worldPointer() ?? start
      const temp = tempRef.current
      if (temp) {
        temp.points(bezierPoints(start, world))
        temp.visible(true)
        layer.batchDraw()
      }
    },
    []
  )

  /** 连线方向总是从输出端口指向输入端口，与拖拽起点是哪一端无关。 */
  const completeConnect = (
    drag: { from: string; side: "in" | "out" },
    to: string
  ) => {
    if (drag.from !== to) {
      const source = drag.side === "out" ? drag.from : to
      const target = drag.side === "out" ? to : drag.from
      latest.current.onConnect(source, target)
    }
    endConnect()
  }

  const endConnect = () => {
    dragRef.current = null
    setHoverTarget(null)
    tempRef.current?.visible(false)
    layerRef.current?.batchDraw()
  }

  const handlePortUp = useCallback(
    (id: string) => {
      const drag = dragRef.current
      if (drag?.kind !== "connect") {
        return
      }
      completeConnect(drag, id)
    },
    // completeConnect 只读取 latest ref 与 dragRef，引用稳定。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [latest]
  )

  const handleMouseMove = () => {
    const drag = dragRef.current
    if (drag?.kind !== "connect") {
      return
    }
    const world = worldPointer()
    if (!world) {
      return
    }
    const hit = hitNodeFromBounds(latest.current.nodeBounds, world)
    const candidate = hit && hit.id !== drag.from ? hit.id : null
    if (candidate !== drag.hover) {
      drag.hover = candidate
      setHoverTarget(candidate)
    }
    const fromNode = latest.current.index.byId.get(drag.from)
    const temp = tempRef.current
    if (fromNode && temp) {
      const toNode = candidate
        ? latest.current.index.byId.get(candidate)
        : undefined
      const anchor =
        drag.side === "out" ? outputOf(fromNode) : inputOf(fromNode)
      const free = toNode
        ? drag.side === "out"
          ? inputOf(toNode)
          : outputOf(toNode)
        : world
      temp.points(
        drag.side === "out"
          ? bezierPoints(anchor, free)
          : bezierPoints(free, anchor)
      )
      layerRef.current?.batchDraw()
    }
  }

  const handleMouseUp = () => {
    const drag = dragRef.current
    if (drag?.kind !== "connect") {
      return
    }
    if (drag.hover) {
      completeConnect(drag, drag.hover)
    } else {
      endConnect()
    }
  }

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault()
    const stage = stageRef.current
    const pointer = stage?.getPointerPosition()
    if (!stage || !pointer) {
      return
    }
    const oldScale = stage.scaleX()
    const direction = event.evt.deltaY > 0 ? -1 : 1
    const scale = clamp(
      oldScale * (direction > 0 ? 1.1 : 1 / 1.1),
      MIN_ZOOM,
      MAX_ZOOM
    )
    const origin = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }
    stage.scale({ x: scale, y: scale })
    stage.position({
      x: pointer.x - origin.x * scale,
      y: pointer.y - origin.y * scale,
    })
    stage.batchDraw()
    scheduleViewportCommit()
  }

  const handleStageMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
    setMenu(null)
    if (event.target === event.target.getStage()) {
      latest.current.onSelect(null)
    }
  }

  const handleStageDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    if (event.target !== stageRef.current) {
      return
    }
    scheduleViewportCommit()
  }

  const handleContextMenu = (event: Konva.KonvaEventObject<PointerEvent>) => {
    event.evt.preventDefault()
    const stage = stageRef.current
    const pointer = stage?.getPointerPosition()
    if (!stage || !pointer) {
      return
    }
    const world = worldPointer() ?? { x: 0, y: 0 }
    let context: MenuContext = { kind: "canvas", world }
    const owner =
      [event.target, ...event.target.getAncestors()].find(
        (candidate) => candidate.attrs.nodeId || candidate.attrs.edgeId
      ) ?? event.target
    const nodeId = owner.attrs.nodeId as string | undefined
    const edgeId = owner.attrs.edgeId as string | undefined
    if (nodeId) {
      context = { kind: "node", id: nodeId, world }
      latest.current.onSelect({ type: "node", id: nodeId })
    } else if (edgeId) {
      context = { kind: "edge", id: edgeId, world }
      latest.current.onSelect({ type: "edge", id: edgeId })
    }
    setMenu({ x: pointer.x, y: pointer.y, context })
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-0 w-full overflow-hidden"
      role="application"
      aria-label={labels.ariaLabel}
    >
      {size.width > 0 && size.height > 0 ? (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.zoom}
          scaleY={viewport.zoom}
          draggable
          onWheel={handleWheel}
          onMouseDown={handleStageMouseDown}
          onContextMenu={handleContextMenu}
          onDragEnd={handleStageDragEnd}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={endConnect}
        >
          <Layer listening={false}>
            <GridBackground
              width={size.width}
              height={size.height}
              viewport={viewport}
              palette={palette}
            />
          </Layer>

          <Layer ref={layerRef}>
            {edges.map((edge) => {
              const points = edgeGeometry.get(edge.id)
              if (!points) {
                return null
              }
              return (
                <CanvasEdgeView
                  key={edge.id}
                  edge={edge}
                  points={points}
                  selected={
                    selection?.type === "edge" && selection.id === edge.id
                  }
                  status={edgeStatus(edge.id)}
                  palette={palette}
                  onSelect={handleSelectEdge}
                />
              )
            })}

            <Arrow
              ref={tempRef}
              visible={false}
              points={[0, 0, 0, 0]}
              stroke={palette.pending}
              fill={palette.pending}
              strokeWidth={2}
              dash={[6, 4]}
              pointerLength={8}
              pointerWidth={7}
              listening={false}
            />

            {nodes.map((node) => (
              <CanvasNodeView
                key={node.id}
                node={node}
                selected={
                  selection?.type === "node" && selection.id === node.id
                }
                highlighted={hoverTarget === node.id}
                status={nodeStatus(node.id)}
                palette={palette}
                kindLabel={kindLabelOf(node, labels)}
                detail={nodeDetail(node)}
                onSelect={handleSelectNode}
                onDragMove={handleNodeDragMove}
                onDragEnd={handleNodeDragEnd}
                onPortDown={handlePortDown}
                onPortUp={handlePortUp}
              />
            ))}
          </Layer>
        </Stage>
      ) : null}

      {nodes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">
          {labels.empty}
        </div>
      ) : null}

      {menu ? (
        <CanvasContextMenu
          x={menu.x}
          y={menu.y}
          items={buildMenu(menu.context)}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  )
}

function kindLabelOf(node: StorageNode, labels: CanvasLabels) {
  if (node.kind === "action") {
    return labels.sync
  }
  return labels.storage
}

/** 端口位置依赖节点种类（尺寸不同），所以这里必须接收完整的 StorageNode。 */
function outputOf(node: StorageNode, position?: Position) {
  return outputPort({ ...node, position: position ?? node.position })
}

function inputOf(node: StorageNode, position?: Position) {
  return inputPort({ ...node, position: position ?? node.position })
}

/** ComfyUI 式的点阵/网格背景，只在可见区域内绘制。 */
const GridBackground = memo(function GridBackground({
  width,
  height,
  viewport,
  palette,
}: {
  width: number
  height: number
  viewport: Viewport
  palette: CanvasPalette
}) {
  const step = 24
  const startX = Math.floor(-viewport.x / viewport.zoom / step) * step
  const startY = Math.floor(-viewport.y / viewport.zoom / step) * step
  const endX = startX + width / viewport.zoom + step
  const endY = startY + height / viewport.zoom + step
  return (
    <>
      <Rect
        x={startX}
        y={startY}
        width={endX - startX}
        height={endY - startY}
        fill={palette.background}
      />
      <Shape
        listening={false}
        stroke={palette.grid}
        strokeWidth={1 / viewport.zoom}
        sceneFunc={(context, shape) => {
          context.beginPath()
          for (let x = startX; x <= endX; x += step) {
            context.moveTo(x, startY)
            context.lineTo(x, endY)
          }
          for (let y = startY; y <= endY; y += step) {
            context.moveTo(startX, y)
            context.lineTo(endX, y)
          }
          context.strokeShape(shape)
        }}
      />
    </>
  )
})

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function hitNodeFromBounds(
  bounds: Array<{ node: StorageNode; rect: ReturnType<typeof nodeRect> }>,
  point: Position
): StorageNode | null {
  for (let i = bounds.length - 1; i >= 0; i -= 1) {
    const { node, rect } = bounds[i]
    if (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    ) {
      return node
    }
  }
  return null
}
