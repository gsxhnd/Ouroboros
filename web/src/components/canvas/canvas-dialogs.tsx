import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FolderOpenIcon } from "lucide-react"

import { DirectoryPicker } from "@/components/canvas/directory-picker"
import { SelectField, SwitchField } from "@/components/shared"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ActionSettings } from "@/stores/canvas-store"
import type {
  ConnectionEdge,
  EdgeKind,
  RemoteInfo,
  StorageNode,
} from "@/lib/types"
import { operationOptions, scheduleOptions } from "@/components/canvas/options"

export type ActionMode = "create" | "edit"

/** 新建本地目录：路径可以手输，也可以通过文件选择器选取。 */
export function LocalNodeDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (label: string, path: string) => void
}) {
  const { t } = useTranslation()
  const [label, setLabel] = useState("")
  const [path, setPath] = useState("")
  const [pickerOpen, setPickerOpen] = useState(false)

  const reset = () => {
    setLabel("")
    setPath("")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) reset()
        onOpenChange(value)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("canvas.menu.newLocalStorage")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t("canvas.nodeLabel")}</Label>
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("transfers.localPath")}</Label>
            <div className="flex gap-2">
              <Input
                value={path}
                className="font-mono"
                placeholder={t("transfers.localPathPlaceholder")}
                onChange={(event) => setPath(event.target.value)}
              />
              <Button variant="outline" onClick={() => setPickerOpen(true)}>
                <FolderOpenIcon /> {t("canvas.picker.browse")}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("common.cancel")}
          </DialogClose>
          <Button
            disabled={!path.trim()}
            onClick={() => {
              onSubmit(label, path)
              reset()
            }}
          >
            {t("common.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
      <DirectoryPicker
        open={pickerOpen}
        initial={path}
        onOpenChange={setPickerOpen}
        onPick={(picked) => setPath(picked)}
      />
    </Dialog>
  )
}

/** 新建远程存储节点：选择已有 remote，并可跳转到 rclone remote 的创建表单。 */
export function RemoteNodeDialog({
  open,
  remotes,
  onOpenChange,
  onCreateRemote,
  onSubmit,
}: {
  open: boolean
  remotes: RemoteInfo[]
  onOpenChange: (open: boolean) => void
  onCreateRemote: () => void
  onSubmit: (label: string, remoteName: string, remotePath: string) => void
}) {
  const { t } = useTranslation()
  const [label, setLabel] = useState("")
  const [remoteName, setRemoteName] = useState("")
  const [remotePath, setRemotePath] = useState("")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("canvas.menu.newRemoteStorage")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <SelectField
            label="remote"
            value={remoteName}
            options={remotes.map((r) => ({ value: r.name, label: r.name }))}
            onChange={setRemoteName}
            disabled={remotes.length === 0}
            placeholder={
              remotes.length === 0 ? t("transfers.noRemotes") : undefined
            }
          />
          <div className="flex flex-col gap-1.5">
            <Label>{t("canvas.nodeLabel")}</Label>
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("transfers.remotePath")}</Label>
            <Input
              value={remotePath}
              placeholder={t("canvas.remotePathPlaceholder")}
              className="font-mono"
              onChange={(event) => setRemotePath(event.target.value)}
            />
          </div>
          <Button
            variant="link"
            size="sm"
            className="self-start px-0"
            onClick={onCreateRemote}
          >
            {t("canvas.menu.createRemote")}
          </Button>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("common.cancel")}
          </DialogClose>
          <Button
            disabled={!remoteName}
            onClick={() => {
              onSubmit(label, remoteName, remotePath)
              setLabel("")
              setRemotePath("")
            }}
          >
            {t("common.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** 编辑存储节点的名称与位置；remote 引用限定为已配置的 remote。 */
export function EditStorageNodeDialog({
  node,
  remotes,
  onOpenChange,
  onSubmit,
}: {
  node: StorageNode | undefined
  remotes: RemoteInfo[]
  onOpenChange: (open: boolean) => void
  onSubmit: (
    node: StorageNode,
    values: { label: string; path: string; remoteName: string }
  ) => void
}) {
  return (
    <Dialog open={Boolean(node)} onOpenChange={onOpenChange}>
      {node ? (
        <EditStorageNodeBody
          key={node.id}
          node={node}
          remotes={remotes}
          onSubmit={onSubmit}
        />
      ) : null}
    </Dialog>
  )
}

function EditStorageNodeBody({
  node,
  remotes,
  onSubmit,
}: {
  node: StorageNode
  remotes: RemoteInfo[]
  onSubmit: (
    node: StorageNode,
    values: { label: string; path: string; remoteName: string }
  ) => void
}) {
  const { t } = useTranslation()
  const [label, setLabel] = useState(node.label)
  const [path, setPath] = useState(
    node.kind === "local" ? (node.local_path ?? "") : (node.remote?.path ?? "")
  )
  const [remoteName, setRemoteName] = useState(node.remote?.name ?? "")
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("canvas.menu.editStorage")}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>{t("canvas.nodeLabel")}</Label>
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
        {node.kind === "local" ? (
          <div className="flex flex-col gap-1.5">
            <Label>{t("canvas.localPath")}</Label>
            <div className="flex gap-2">
              <Input
                className="font-mono"
                value={path}
                onChange={(event) => setPath(event.target.value)}
              />
              <Button variant="outline" onClick={() => setPickerOpen(true)}>
                <FolderOpenIcon /> {t("canvas.picker.browse")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <SelectField
              label={t("transfers.kindRemote")}
              value={remoteName}
              options={remotes.map((remote) => ({
                value: remote.name,
                label: remote.name,
              }))}
              onChange={setRemoteName}
              disabled={remotes.length === 0}
            />
            <div className="flex flex-col gap-1.5">
              <Label>{t("transfers.remotePath")}</Label>
              <Input
                className="font-mono"
                value={path}
                onChange={(event) => setPath(event.target.value)}
              />
            </div>
          </>
        )}
      </div>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>
          {t("common.cancel")}
        </DialogClose>
        <Button
          disabled={
            !label.trim() ||
            (node.kind === "local" ? !path.trim() : !remoteName)
          }
          onClick={() =>
            onSubmit(node, {
              label: label.trim(),
              path: path.trim(),
              remoteName,
            })
          }
        >
          {t("common.save")}
        </Button>
      </DialogFooter>
      {node.kind === "local" ? (
        <DirectoryPicker
          open={pickerOpen}
          initial={path}
          onOpenChange={setPickerOpen}
          onPick={setPath}
        />
      ) : null}
    </DialogContent>
  )
}

/** 动作节点的新建与编辑共用一个表单：操作、计划、启停。 */
export function ActionDialog({
  open,
  mode,
  initial,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  mode: ActionMode
  initial: { label: string; settings: ActionSettings }
  onOpenChange: (open: boolean) => void
  onSubmit: (label: string, settings: ActionSettings) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <ActionDialogBody mode={mode} initial={initial} onSubmit={onSubmit} />
      ) : null}
    </Dialog>
  )
}

function ActionDialogBody({
  mode,
  initial,
  onSubmit,
}: {
  mode: ActionMode
  initial: { label: string; settings: ActionSettings }
  onSubmit: (label: string, settings: ActionSettings) => void
}) {
  const { t } = useTranslation()
  const [label, setLabel] = useState(initial.label)
  const [settings, setSettings] = useState<ActionSettings>(initial.settings)

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {mode === "create"
            ? t("canvas.menu.newAction")
            : t("canvas.menu.editAction")}
        </DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>{t("canvas.nodeLabel")}</Label>
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
        <SelectField
          label={t("transfers.operation")}
          value={settings.operation}
          options={operationOptions(t)}
          onChange={(operation) =>
            setSettings((current) => ({ ...current, operation }))
          }
        />
        <SelectField
          label={t("transfers.schedule")}
          value={settings.schedule}
          options={scheduleOptions(t)}
          onChange={(schedule) =>
            setSettings((current) => ({ ...current, schedule }))
          }
        />
        <SwitchField
          label={t("transfers.defaultEnabled")}
          checked={settings.enabled}
          onCheckedChange={(enabled) =>
            setSettings((current) => ({ ...current, enabled }))
          }
        />
      </div>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>
          {t("common.cancel")}
        </DialogClose>
        <Button
          onClick={() =>
            onSubmit(label.trim() || t("canvas.menu.newAction"), settings)
          }
        >
          {mode === "create" ? t("common.create") : t("common.save")}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

/** 连线：只创建数据流（存储 ↔ 动作）或挂载；由调用方提供已判定好的类型。 */
export function ConnectDialog({
  open,
  nodes,
  source,
  target,
  kind,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  nodes: StorageNode[]
  source: string
  target: string
  kind: EdgeKind
  onOpenChange: (open: boolean) => void
  onSubmit: (source: string, target: string, kind: EdgeKind) => void
}) {
  const { t } = useTranslation()
  const sourceNode = nodes.find((node) => node.id === source)
  const targetNode = nodes.find((node) => node.id === target)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("canvas.menu.connect")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 text-sm">
          <span>
            <span className="text-muted-foreground">
              {t("transfers.source")}：
            </span>
            {sourceNode?.label ?? "—"}
          </span>
          <span>
            <span className="text-muted-foreground">
              {t("transfers.target")}：
            </span>
            {targetNode?.label ?? "—"}
          </span>
          <span className="text-muted-foreground">
            {kind === "mount"
              ? t("canvas.rules.mountHint")
              : t("canvas.rules.flowHint")}
          </span>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("common.cancel")}
          </DialogClose>
          <Button onClick={() => onSubmit(source, target, kind)}>
            {t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** 编辑已有的挂载边（启停）或数据流边（无参数，仅展示关系）。 */
export function EditEdgeDialog({
  edge,
  onOpenChange,
  onToggle,
}: {
  edge: ConnectionEdge | undefined
  onOpenChange: (open: boolean) => void
  onToggle: (id: string, enabled: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={Boolean(edge)} onOpenChange={onOpenChange}>
      {edge ? (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("canvas.menu.editEdge")}</DialogTitle>
          </DialogHeader>
          <SwitchField
            label={t("transfers.defaultEnabled")}
            checked={
              edge.kind === "mount" ? edge.mount?.enabled !== false : true
            }
            disabled={edge.kind !== "mount"}
            onCheckedChange={(enabled) => onToggle(edge.id, enabled)}
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("common.cancel")}
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

export function RenameNodeDialog({
  node,
  onOpenChange,
  onSubmit,
}: {
  node: StorageNode | undefined
  onOpenChange: (open: boolean) => void
  onSubmit: (id: string, label: string) => Promise<void>
}) {
  return (
    <Dialog open={Boolean(node)} onOpenChange={onOpenChange}>
      {node ? (
        <RenameBody key={node.id} node={node} onSubmit={onSubmit} />
      ) : null}
    </Dialog>
  )
}

function RenameBody({
  node,
  onSubmit,
}: {
  node: StorageNode
  onSubmit: (id: string, label: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [label, setLabel] = useState(node.label)
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("canvas.menu.rename")}</DialogTitle>
      </DialogHeader>
      <Input value={label} onChange={(event) => setLabel(event.target.value)} />
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>
          {t("common.cancel")}
        </DialogClose>
        <Button
          disabled={!label.trim()}
          onClick={() => void onSubmit(node.id, label.trim())}
        >
          {t("common.save")}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
