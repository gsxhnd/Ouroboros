import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  CableIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  GitBranchIcon,
  KeyRoundIcon,
  Maximize2Icon,
  PencilIcon,
  PlayIcon,
  PlugIcon,
  SaveIcon,
  SquareIcon,
  Trash2Icon,
  Unplug,
  WorkflowIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  type CanvasSelection,
  CanvasWorkspace,
  type MenuContext,
} from "@/components/canvas/canvas-workspace"
import {
  ActionDialog,
  ConnectDialog,
  EditStorageNodeDialog,
  EditEdgeDialog,
  LocalNodeDialog,
  RemoteNodeDialog,
  RenameNodeDialog,
  type ActionMode,
} from "@/components/canvas/canvas-dialogs"
import type { ContextMenuItem } from "@/components/canvas/context-menu"
import { FloatingPanel } from "@/components/canvas/floating-panel"
import type { EdgeStatus } from "@/components/canvas/canvas-edges"
import type { NodeStatus } from "@/components/canvas/canvas-nodes"
import { RemoteFormDialog } from "@/components/remote-form-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FilesPage } from "@/pages/files"
import { callQuiet } from "@/lib/client"
import { connectionFor, CONNECTION_MESSAGE } from "@/lib/canvas/rules"
import {
  type ActionSettings,
  type SchedulePreset,
  TERMINAL_JOB_STATUSES,
  subscribeRuntime,
  useCanvasStore,
} from "@/stores/canvas-store"
import type {
  ConnectionEdge,
  EdgeKind,
  JobSnapshot,
  Position,
  RemoteInfo,
  StorageNode,
} from "@/lib/types"

/** 与 mounts 页保持一致：挂载中、已挂载、卸载中都占用这条连线的挂载状态。 */
const ATTACHED_MOUNT: ReadonlySet<string> = new Set([
  "mounted",
  "starting",
  "stopping",
])
const IN_FLIGHT_MOUNT: ReadonlySet<string> = new Set(["starting", "stopping"])

const DEFAULT_ACTION: ActionSettings = {
  operation: "copy",
  schedule: "manual",
  enabled: true,
}

type Dialog =
  | { type: "local"; world: Position | null }
  | { type: "remote"; world: Position | null }
  | {
      type: "action"
      mode: ActionMode
      nodeId?: string
      world: Position | null
    }
  | {
      type: "remoteForm"
      editing: string | null
      world: Position | null
      createNode: boolean
    }
  | { type: "connect"; source: string; target: string; kind: EdgeKind }
  | { type: "editEdge"; id: string }
  | { type: "editStorage"; id: string }
  | { type: "renameNode"; id: string }
  | null

export function CanvasPage() {
  const { t } = useTranslation()
  const loaded = useCanvasStore((state) => state.loaded)
  const error = useCanvasStore((state) => state.error)
  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)
  const viewport = useCanvasStore((state) => state.viewport)
  const jobs = useCanvasStore((state) => state.jobs)
  const mounts = useCanvasStore((state) => state.mounts)
  const load = useCanvasStore((state) => state.load)
  const moveNode = useCanvasStore((state) => state.moveNode)
  const setViewport = useCanvasStore((state) => state.setViewport)
  const saveViewport = useCanvasStore((state) => state.saveViewport)
  const createNode = useCanvasStore((state) => state.createNode)
  const renameNode = useCanvasStore((state) => state.renameNode)
  const updateStorageNode = useCanvasStore((state) => state.updateStorageNode)
  const deleteNode = useCanvasStore((state) => state.deleteNode)
  const createEdge = useCanvasStore((state) => state.createEdge)
  const deleteEdge = useCanvasStore((state) => state.deleteEdge)
  const updateEdge = useCanvasStore((state) => state.updateEdge)
  const updateAction = useCanvasStore((state) => state.updateAction)
  const runAction = useCanvasStore((state) => state.runAction)
  const stopJob = useCanvasStore((state) => state.stopJob)
  const mountEdge = useCanvasStore((state) => state.mountEdge)
  const unmountEdge = useCanvasStore((state) => state.unmountEdge)

  const [selection, setSelection] = useState<CanvasSelection>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [remotes, setRemotes] = useState<RemoteInfo[]>([])
  const [busyEdge, setBusyEdge] = useState<string | null>(null)
  const [filesOpen, setFilesOpen] = useState(false)

  useEffect(() => {
    const run = async () => {
      await load()
    }
    void run()
    return subscribeRuntime()
  }, [load])

  const loadRemotes = useCallback(async () => {
    try {
      const data = await callQuiet<{ remotes: RemoteInfo[] }>("/api/remotes")
      setRemotes(data.remotes)
    } catch {
      setRemotes([])
    }
  }, [])

  useEffect(() => {
    const run = async () => {
      await loadRemotes()
    }
    void run()
  }, [loadRemotes])

  const nodeById = useCallback(
    (id: string) => nodes.find((node) => node.id === id),
    [nodes]
  )
  const edgeById = useCallback(
    (id: string) => edges.find((edge) => edge.id === id),
    [edges]
  )

  const runningJobs = useMemo(
    () => jobs.filter((job) => !TERMINAL_JOB_STATUSES.has(job.status)),
    [jobs]
  )

  /** 节点运行状态：动作节点看自己的 job，存储节点看参与运行的任何 job。 */
  const nodeStatus = useCallback(
    (id: string): NodeStatus => {
      const node = nodeById(id)
      if (
        node?.kind === "action" &&
        runningJobs.some((job) => job.edge_id === id)
      ) {
        return "running"
      }
      if (
        node?.kind !== "action" &&
        runningJobs.some((job) => {
          const owner = nodeById(job.edge_id)
          return (
            owner?.kind === "action" && flowsOf(edges, owner.id).includes(id)
          )
        })
      ) {
        return "running"
      }
      const mounted = mounts.find((mount) => {
        const edge = edgeById(mount.edge_id)
        return (
          edge &&
          (edge.source === id || edge.target === id) &&
          ATTACHED_MOUNT.has(mount.status)
        )
      })
      if (mounted) {
        return "mounted"
      }
      return "idle"
    },
    [runningJobs, mounts, nodeById, edgeById, edges]
  )

  const edgeStatus = useCallback(
    (id: string): EdgeStatus => {
      const edge = edgeById(id)
      if (edge?.kind === "flow") {
        const action =
          nodeById(edge.source)?.kind === "action" ? edge.source : edge.target
        return runningJobs.some((job) => job.edge_id === action)
          ? "running"
          : "idle"
      }
      if (runningJobs.some((job) => job.edge_id === id)) {
        return "running"
      }
      const mount = mounts.find((item) => item.edge_id === id)
      if (mount && ATTACHED_MOUNT.has(mount.status)) {
        return "mounted"
      }
      if (mount?.status === "failed") {
        return "failed"
      }
      return "idle"
    },
    [runningJobs, mounts, edgeById, nodeById]
  )

  const mountBusy = (id: string) => {
    const status = mounts.find((item) => item.edge_id === id)?.status
    return (
      busyEdge === id || (status !== undefined && IN_FLIGHT_MOUNT.has(status))
    )
  }

  /** 动作节点的副标题：操作 · 计划 · 上次结果。 */
  const nodeDetail = useCallback(
    (node: StorageNode): string => {
      if (node.kind === "action" && node.action) {
        const op = t(`transfers.operationLabels.${node.action.operation}`, {
          defaultValue: node.action.operation,
        })
        const schedule = node.action.schedule.enabled
          ? t(`canvas.schedule.${node.action.schedule.preset ?? "daily"}`)
          : t("canvas.schedule.manual")
        const enabled = node.action.enabled
          ? ""
          : ` · ${t("transfers.disabled")}`
        return `${op} · ${schedule}${enabled}`
      }
      if (node.kind === "local") {
        return node.local_path ?? ""
      }
      return `${node.remote?.name ?? ""}:${node.remote?.path ?? ""}`
    },
    [t]
  )

  const handleDelete = useCallback(async () => {
    if (!selection) {
      return
    }
    if (selection.type === "node") {
      const node = nodeById(selection.id)
      const linked = edges.filter(
        (e) => e.source === selection.id || e.target === selection.id
      )
      if (
        !window.confirm(
          t("canvas.confirmDeleteNode", {
            name: node?.label ?? "",
            count: linked.length,
          })
        )
      ) {
        return
      }
      await deleteNode(selection.id)
    } else {
      if (!window.confirm(t("canvas.confirmDeleteEdge"))) {
        return
      }
      await deleteEdge(selection.id)
    }
    setSelection(null)
  }, [selection, nodeById, edges, deleteNode, deleteEdge, t])

  const handleRunAction = async (id: string) => {
    try {
      await runAction(id)
      toast.success(t("canvas.jobStarted"))
    } catch {
      // call() 已经弹出错误提示。
    }
  }

  const handleMount = async (id: string, mounted: boolean) => {
    setBusyEdge(id)
    try {
      if (mounted) {
        await unmountEdge(id)
      } else {
        await mountEdge(id)
      }
    } catch {
      // call() 已经弹出错误提示。
    } finally {
      setBusyEdge(null)
    }
  }

  const tryConnect = (source: string, target: string) => {
    const from = nodeById(source)
    const to = nodeById(target)
    if (!from || !to) {
      return
    }
    const result = connectionFor(from, to)
    if (!result.ok) {
      toast.warning(t(CONNECTION_MESSAGE[result.reason]))
      return
    }
    setDialog({ type: "connect", source, target, kind: result.kind })
  }

  const buildMenu = (context: MenuContext): ContextMenuItem[] => {
    if (context.kind === "canvas") {
      return [
        item(
          "new-local",
          t("canvas.menu.newLocalStorage"),
          <FolderPlusIcon />,
          () => setDialog({ type: "local", world: context.world })
        ),
        item(
          "new-remote",
          t("canvas.menu.newRemoteStorage"),
          <KeyRoundIcon />,
          () => setDialog({ type: "remote", world: context.world })
        ),
        item("new-action", t("canvas.menu.newAction"), <WorkflowIcon />, () =>
          setDialog({ type: "action", mode: "create", world: context.world })
        ),
        { type: "separator" },
        item("browse", t("canvas.menu.browse"), <FolderOpenIcon />, () =>
          setFilesOpen(true)
        ),
        item("fit", t("canvas.fitView"), <Maximize2Icon />, () =>
          setViewport({ x: 0, y: 0, zoom: 1 })
        ),
        item(
          "save-view",
          t("canvas.saveView"),
          <SaveIcon />,
          () => void saveViewport()
        ),
      ]
    }

    if (context.kind === "node") {
      const node = nodeById(context.id)
      if (!node) {
        return []
      }
      const items: ContextMenuItem[] = [
        item("rename", t("canvas.menu.rename"), <PencilIcon />, () =>
          setDialog({ type: "renameNode", id: node.id })
        ),
      ]
      if (node.kind !== "action") {
        items.push(
          item(
            "edit-storage",
            t("canvas.menu.editStorage"),
            <FolderOpenIcon />,
            () => setDialog({ type: "editStorage", id: node.id })
          )
        )
      }
      if (node.kind === "action") {
        items.push(
          item(
            "run-action",
            t("transfers.runNow"),
            <PlayIcon />,
            () => void handleRunAction(node.id),
            {
              disabled: node.action?.enabled === false,
            }
          ),
          item(
            "edit-action",
            t("canvas.menu.editAction"),
            <WorkflowIcon />,
            () =>
              setDialog({
                type: "action",
                mode: "edit",
                nodeId: node.id,
                world: null,
              })
          )
        )
      }
      if (node.kind === "remote") {
        items.push(
          item(
            "edit-remote",
            t("canvas.menu.editRemote"),
            <KeyRoundIcon />,
            () =>
              setDialog({
                type: "remoteForm",
                editing: node.remote?.name ?? null,
                world: null,
                createNode: false,
              })
          )
        )
      }
      items.push({ type: "separator" })
      items.push(
        item(
          "delete-node",
          t("common.delete"),
          <Trash2Icon />,
          () => {
            setSelection({ type: "node", id: node.id })
            const linked = edges.filter(
              (e) => e.source === node.id || e.target === node.id
            )
            if (
              window.confirm(
                t("canvas.confirmDeleteNode", {
                  name: node.label,
                  count: linked.length,
                })
              )
            ) {
              void deleteNode(node.id).then(() => setSelection(null))
            }
          },
          { destructive: true }
        )
      )
      return items
    }

    const edge = edgeById(context.id)
    if (!edge) {
      return []
    }
    const items: ContextMenuItem[] = []
    if (edge.kind === "mount") {
      const mounted = edgeStatus(edge.id) === "mounted"
      items.push(
        item(
          "mount",
          mounted ? t("mounts.unmount") : t("mounts.mount"),
          mounted ? <Unplug /> : <PlugIcon />,
          () => void handleMount(edge.id, mounted),
          { disabled: mountBusy(edge.id) }
        )
      )
    }
    items.push(
      item("edit-edge", t("canvas.menu.editEdge"), <PencilIcon />, () =>
        setDialog({ type: "editEdge", id: edge.id })
      ),
      { type: "separator" },
      item(
        "delete-edge",
        t("common.delete"),
        <Trash2Icon />,
        () => {
          setSelection({ type: "edge", id: edge.id })
          if (window.confirm(t("canvas.confirmDeleteEdge"))) {
            void deleteEdge(edge.id).then(() => setSelection(null))
          }
        },
        { destructive: true }
      )
    )
    return items
  }

  if (!loaded) {
    return <CanvasMessage>{t("canvas.loading")}</CanvasMessage>
  }

  if (error) {
    return <CanvasMessage>{error}</CanvasMessage>
  }

  const selectedEdge =
    selection?.type === "edge" ? edgeById(selection.id) : undefined
  const selectedNode =
    selection?.type === "node" ? nodeById(selection.id) : undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border bg-background">
        <CanvasWorkspace
          nodes={nodes}
          edges={edges}
          viewport={viewport}
          selection={selection}
          labels={{
            ariaLabel: t("canvas.ariaLabel"),
            empty: t("canvas.empty"),
            storage: t("canvas.kind.storage"),
            sync: t("canvas.kind.sync"),
          }}
          nodeStatus={nodeStatus}
          edgeStatus={edgeStatus}
          nodeDetail={nodeDetail}
          onSelect={setSelection}
          onNodeMove={(id, position) => void moveNode(id, position)}
          onViewportChange={setViewport}
          onConnect={tryConnect}
          onDeleteSelection={() => void handleDelete()}
          buildMenu={buildMenu}
        />

        <FloatingPanel
          title={t("canvas.panel.title")}
          initial={{ x: 12, y: 12 }}
        >
          <PanelButton
            icon={<FolderOpenIcon />}
            label={t("canvas.toolbar.storageLocal")}
            onClick={() => setDialog({ type: "local", world: null })}
          />
          <PanelButton
            icon={<KeyRoundIcon />}
            label={t("canvas.toolbar.storageRemote")}
            onClick={() => setDialog({ type: "remote", world: null })}
          />
          <PanelButton
            icon={<WorkflowIcon />}
            label={t("canvas.toolbar.action")}
            onClick={() =>
              setDialog({ type: "action", mode: "create", world: null })
            }
          />
          <div className="my-0.5 h-px bg-border" aria-hidden />
          <PanelButton
            icon={<CableIcon />}
            label={t("canvas.toolbar.browse")}
            onClick={() => setFilesOpen(true)}
          />
          <PanelButton
            icon={<GitBranchIcon />}
            label={t("canvas.toolbar.remoteForm")}
            onClick={() =>
              setDialog({
                type: "remoteForm",
                editing: null,
                world: null,
                createNode: false,
              })
            }
          />
          <div className="my-0.5 h-px bg-border" aria-hidden />
          <PanelButton
            icon={<Maximize2Icon />}
            label={t("canvas.fitView")}
            onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}
          />
          <PanelButton
            icon={<SaveIcon />}
            label={t("canvas.saveView")}
            onClick={() => void saveViewport()}
          />
        </FloatingPanel>

        {selection ? (
          <div className="absolute end-3 top-3 flex max-w-xs items-center gap-1.5 rounded-xl border bg-popover/95 p-1.5 text-sm shadow-md backdrop-blur">
            {selectedNode ? (
              <span className="min-w-0 flex-1 truncate px-1.5 font-medium">
                {selectedNode.label}
              </span>
            ) : null}
            {selectedNode?.kind === "action" ? (
              <Button
                size="sm"
                disabled={selectedNode.action?.enabled === false}
                onClick={() => void handleRunAction(selectedNode.id)}
              >
                <PlayIcon /> {t("transfers.runNow")}
              </Button>
            ) : null}
            {selectedNode ? (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t("canvas.menu.rename")}
                onClick={() =>
                  setDialog({ type: "renameNode", id: selectedNode.id })
                }
              >
                <PencilIcon />
              </Button>
            ) : null}
            {selectedNode && selectedNode.kind !== "action" ? (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t("canvas.menu.editStorage")}
                onClick={() =>
                  setDialog({ type: "editStorage", id: selectedNode.id })
                }
              >
                <FolderOpenIcon />
              </Button>
            ) : null}
            {selectedEdge?.kind === "mount" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={mountBusy(selectedEdge.id)}
                onClick={() =>
                  void handleMount(
                    selectedEdge.id,
                    edgeStatus(selectedEdge.id) === "mounted"
                  )
                }
              >
                {edgeStatus(selectedEdge.id) === "mounted" ? (
                  <Unplug />
                ) : (
                  <PlugIcon />
                )}
                {edgeStatus(selectedEdge.id) === "mounted"
                  ? t("mounts.unmount")
                  : t("mounts.mount")}
              </Button>
            ) : null}
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-destructive"
              aria-label={t("common.delete")}
              onClick={() => void handleDelete()}
            >
              <Trash2Icon />
            </Button>
          </div>
        ) : null}

        {runningJobs.length > 0 ? (
          <RunningJobsPanel
            jobs={runningJobs}
            onStop={(id) => void stopJob(id)}
          />
        ) : null}
      </div>

      <LocalNodeDialog
        open={dialog?.type === "local"}
        onOpenChange={(open) => !open && setDialog(null)}
        onSubmit={(label, path) => {
          const world = dialog?.type === "local" ? dialog.world : null
          void createNode({
            kind: "local",
            label: label.trim() || path.trim(),
            position: world ?? defaultPosition(nodes),
            local_path: path.trim(),
          }).then(
            (created) =>
              created && setSelection({ type: "node", id: created.id })
          )
          setDialog(null)
        }}
      />

      <RemoteNodeDialog
        open={dialog?.type === "remote"}
        remotes={remotes}
        onOpenChange={(open) => !open && setDialog(null)}
        onCreateRemote={() =>
          setDialog({
            type: "remoteForm",
            editing: null,
            world: dialog?.type === "remote" ? dialog.world : null,
            createNode: true,
          })
        }
        onSubmit={(label, remoteName, remotePath) => {
          const world = dialog?.type === "remote" ? dialog.world : null
          void createNode({
            kind: "remote",
            label: label.trim() || remoteName,
            position: world ?? defaultPosition(nodes),
            remote: { name: remoteName, path: remotePath.trim() },
          }).then(
            (created) =>
              created && setSelection({ type: "node", id: created.id })
          )
          setDialog(null)
        }}
      />

      <ActionDialog
        open={dialog?.type === "action"}
        mode={dialog?.type === "action" ? dialog.mode : "create"}
        initial={actionInitial(dialog, nodes)}
        onOpenChange={(open) => !open && setDialog(null)}
        onSubmit={(label, settings) => {
          if (dialog?.type !== "action") {
            return
          }
          if (dialog.mode === "create") {
            void createNode({
              kind: "action",
              label,
              position: dialog.world ?? defaultPosition(nodes),
              action: settings,
            }).then(
              (created) =>
                created && setSelection({ type: "node", id: created.id })
            )
          } else if (dialog.nodeId) {
            void renameNode(dialog.nodeId, label)
            void updateAction(dialog.nodeId, settings)
          }
          setDialog(null)
        }}
      />

      <RemoteFormDialog
        open={dialog?.type === "remoteForm"}
        editing={dialog?.type === "remoteForm" ? dialog.editing : null}
        onOpenChange={(open) => !open && setDialog(null)}
        onSaved={(name) => {
          void loadRemotes()
          if (dialog?.type === "remoteForm" && dialog.createNode) {
            void createNode({
              kind: "remote",
              label: name,
              position: dialog.world ?? defaultPosition(nodes),
              remote: { name, path: "" },
            })
          }
        }}
      />

      <ConnectDialog
        open={dialog?.type === "connect"}
        nodes={nodes}
        source={dialog?.type === "connect" ? dialog.source : ""}
        target={dialog?.type === "connect" ? dialog.target : ""}
        kind={dialog?.type === "connect" ? dialog.kind : "flow"}
        onOpenChange={(open) => !open && setDialog(null)}
        onSubmit={(source, target, kind) => {
          void createEdge(source, target, kind)
          setDialog(null)
        }}
      />

      <EditEdgeDialog
        edge={dialog?.type === "editEdge" ? edgeById(dialog.id) : undefined}
        onOpenChange={(open) => !open && setDialog(null)}
        onToggle={(id, enabled) => {
          void updateEdge(id, { enabled })
          setDialog(null)
        }}
      />

      <RenameNodeDialog
        node={dialog?.type === "renameNode" ? nodeById(dialog.id) : undefined}
        onOpenChange={(open) => !open && setDialog(null)}
        onSubmit={async (id, label) => {
          await renameNode(id, label)
          setDialog(null)
        }}
      />

      <EditStorageNodeDialog
        node={dialog?.type === "editStorage" ? nodeById(dialog.id) : undefined}
        remotes={remotes}
        onOpenChange={(open) => !open && setDialog(null)}
        onSubmit={async (node, values) => {
          if (node.kind === "local") {
            await updateStorageNode(node.id, {
              label: values.label,
              local_path: values.path,
            })
          } else {
            await updateStorageNode(node.id, {
              label: values.label,
              remote: { name: values.remoteName, path: values.path },
            })
          }
          setDialog(null)
        }}
      />

      <Dialog open={filesOpen} onOpenChange={setFilesOpen}>
        <DialogContent className="flex h-[min(85vh,48rem)] w-[min(94vw,72rem)] max-w-none flex-col gap-0 p-0 sm:max-w-none">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>{t("nav.files")}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 select-text">
            <div className="flex flex-col gap-4">
              <FilesPage />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function item(
  key: string,
  label: string,
  icon: React.ReactNode,
  onSelect: () => void,
  options: { disabled?: boolean; destructive?: boolean } = {}
): ContextMenuItem {
  return { type: "item", key, label, icon, onSelect, ...options }
}

function PanelButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
    >
      <span className="[&>svg]:size-4">{icon}</span>
      {label}
    </button>
  )
}

function actionInitial(
  dialog: Dialog,
  nodes: StorageNode[]
): { label: string; settings: ActionSettings } {
  if (dialog?.type === "action" && dialog.mode === "edit" && dialog.nodeId) {
    const node = nodes.find((item) => item.id === dialog.nodeId)
    const action = node?.action
    return {
      label: node?.label ?? "",
      settings: {
        operation: action?.operation ?? "copy",
        schedule: action?.schedule.enabled
          ? ((action.schedule.preset ?? "daily") as SchedulePreset)
          : "manual",
        enabled: action?.enabled ?? true,
      },
    }
  }
  return { label: "", settings: DEFAULT_ACTION }
}

/** 与动作节点相连的数据流边另一端的存储节点 id 列表。 */
function flowsOf(edges: ConnectionEdge[], actionId: string): string[] {
  return edges
    .filter(
      (edge) =>
        edge.kind === "flow" &&
        (edge.source === actionId || edge.target === actionId)
    )
    .map((edge) => (edge.source === actionId ? edge.target : edge.source))
}

function defaultPosition(nodes: StorageNode[]): Position {
  return {
    x: 260 + (nodes.length % 4) * 260,
    y: 80 + Math.floor(nodes.length / 4) * 130,
  }
}

function CanvasMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center rounded-xl border text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function RunningJobsPanel({
  jobs,
  onStop,
}: {
  jobs: JobSnapshot[]
  onStop: (id: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="absolute end-3 bottom-3 flex w-80 flex-col gap-2 rounded-xl border bg-popover/95 p-3 text-sm shadow-md backdrop-blur">
      <span className="font-medium">
        {t("canvas.runningTitle", { count: jobs.length })}
      </span>
      {jobs.map((job) => (
        <div key={job.id} className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {job.operation} · {job.status}
            {job.progress.percentage > 0
              ? ` · ${job.progress.percentage.toFixed(0)}%`
              : ""}
          </span>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={t("common.stop")}
            onClick={() => onStop(job.id)}
          >
            <SquareIcon />
          </Button>
        </div>
      ))}
    </div>
  )
}
