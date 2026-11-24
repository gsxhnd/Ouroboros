import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  CloudIcon,
  HardDriveIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react"
import { toast } from "sonner"

import { RemoteFormDialog } from "@/components/remote-form-dialog"
import { EmptyHint } from "@/components/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import type { StorageNode } from "@/lib/types"
import { useStorageStore } from "@/stores/storage-store"
import { useRcloneStore } from "@/stores/rclone-store"

type DeleteTarget =
  { kind: "local"; node: StorageNode } | { kind: "remote"; name: string } | null

export function StoragesPage() {
  const { t, i18n } = useTranslation()
  const nodes = useStorageStore((state) => state.nodes)
  const edges = useStorageStore((state) => state.edges)
  const remotes = useStorageStore((state) => state.remotes)
  const loaded = useStorageStore((state) => state.loaded)
  const load = useStorageStore((state) => state.load)
  const createLocal = useStorageStore((state) => state.createLocal)
  const deleteLocal = useStorageStore((state) => state.deleteLocal)
  const deleteRemote = useStorageStore((state) => state.deleteRemote)
  const rcloneRunning = useRcloneStore(
    (state) => state.status?.running ?? false
  )

  const [localOpen, setLocalOpen] = useState(false)
  const [remoteDialogOpen, setRemoteDialogOpen] = useState(false)
  const [editingRemote, setEditingRemote] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const [deleteName, setDeleteName] = useState("")

  useEffect(() => {
    void load()
  }, [load])

  const localNodes = useMemo(
    () => nodes.filter((node) => node.kind === "local"),
    [nodes]
  )

  const usageCount = (nodeID: string) =>
    edges.filter((edge) => edge.source === nodeID || edge.target === nodeID)
      .length

  const providerLabel = (type: string | null | undefined) => {
    if (!type) {
      return t("remotes.untyped")
    }
    const key = `remotes.providers.${type}`
    return i18n.exists(key) ? i18n.t(key) : type
  }

  const requestDelete = (target: DeleteTarget) => {
    setDeleteName("")
    setDeleteTarget(target)
  }

  const confirmDelete = async () => {
    const target = deleteTarget
    if (!target) {
      return
    }
    // remote 删除会连带 rclone 凭据，必须输入名称确认；本地存储用普通确认。
    if (target.kind === "remote" && deleteName.trim() !== target.name) {
      return
    }
    setDeleteTarget(null)
    if (target.kind === "local") {
      await deleteLocal(target.node.id)
      toast.success(t("storage.localDeleted", { name: target.node.label }))
    } else {
      await deleteRemote(target.name)
      toast.success(t("storage.remoteDeleted", { name: target.name }))
    }
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-3 overflow-y-auto select-text">
      <div>
        <h1 className="font-heading text-base font-semibold">
          {t("storage.title")}
        </h1>
        <p className="text-xs text-muted-foreground">{t("storage.subtitle")}</p>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <HardDriveIcon className="size-3.5" aria-hidden />
            {t("storage.localSection")}
          </h2>
          <Button size="xs" onClick={() => setLocalOpen(true)}>
            <PlusIcon />
            {t("storage.newLocal")}
          </Button>
        </div>
        {!loaded ? (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {t("storage.loading")}
          </p>
        ) : localNodes.length === 0 ? (
          <EmptyHint>{t("storage.localEmpty")}</EmptyHint>
        ) : (
          localNodes.map((node) => {
            const used = usageCount(node.id)
            return (
              <Card key={node.id} className="py-2">
                <CardContent className="flex items-center gap-3 px-3">
                  <HardDriveIcon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {node.label || node.local_path}
                      </span>
                      <Badge
                        variant={used > 0 ? "secondary" : "outline"}
                        className="font-normal"
                      >
                        {used > 0
                          ? t("storage.usedBy", { count: used })
                          : t("storage.unused")}
                      </Badge>
                    </div>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {node.local_path}
                    </p>
                  </div>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={t("common.delete")}
                    title={t("common.delete")}
                    onClick={() => requestDelete({ kind: "local", node })}
                  >
                    <TrashIcon />
                  </Button>
                </CardContent>
              </Card>
            )
          })
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CloudIcon className="size-3.5" aria-hidden />
            {t("storage.remoteSection")}
          </h2>
          <Button
            size="xs"
            onClick={() => {
              setEditingRemote(null)
              setRemoteDialogOpen(true)
            }}
          >
            <PlusIcon />
            {t("storage.newRemote")}
          </Button>
        </div>
        {!rcloneRunning ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            {t("storage.rcloneOfflineRemotes")}
          </p>
        ) : remotes.length === 0 ? (
          <EmptyHint>{t("storage.remoteEmpty")}</EmptyHint>
        ) : (
          remotes.map((remote) => (
            <Card key={remote.name} className="py-2">
              <CardContent className="flex items-center gap-3 px-3">
                <CloudIcon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-sm font-medium">
                      {remote.name}
                    </span>
                    <Badge variant="secondary" className="font-normal">
                      {providerLabel(remote.type)}
                    </Badge>
                  </div>
                </div>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t("common.edit")}
                  title={t("common.edit")}
                  onClick={() => {
                    setEditingRemote(remote.name)
                    setRemoteDialogOpen(true)
                  }}
                >
                  <PencilIcon />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t("common.delete")}
                  title={t("common.delete")}
                  onClick={() =>
                    requestDelete({ kind: "remote", name: remote.name })
                  }
                >
                  <TrashIcon />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <CreateLocalDialog
        key={localOpen ? "open" : "closed"}
        open={localOpen}
        onOpenChange={setLocalOpen}
        onCreate={createLocal}
      />

      <RemoteFormDialog
        open={remoteDialogOpen}
        editing={editingRemote}
        onOpenChange={setRemoteDialogOpen}
        onSaved={() => void load()}
      />

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="w-[min(92vw,28rem)] sm:max-w-none">
          <DialogHeader>
            <DialogTitle>{t("storage.deleteTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 text-sm">
            <p className="leading-relaxed text-muted-foreground">
              {deleteTarget?.kind === "remote"
                ? t("storage.deleteRemoteWarning", { name: deleteTarget.name })
                : deleteTarget?.kind === "local"
                  ? t("storage.deleteLocalWarning", {
                      name: deleteTarget.node.label,
                      path: deleteTarget.node.local_path,
                    })
                  : ""}
            </p>
            {deleteTarget?.kind === "remote" ? (
              <Input
                value={deleteName}
                placeholder={deleteTarget.name}
                aria-label={t("storage.deleteTypeHint")}
                onChange={(event) => setDeleteName(event.target.value)}
              />
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("common.cancel")}
            </DialogClose>
            <Button
              variant="destructive"
              disabled={
                deleteTarget?.kind === "remote" &&
                deleteName.trim() !== deleteTarget.name
              }
              onClick={() => void confirmDelete()}
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** 新建本地存储：名称 + 绝对路径，同步任务按路径自动复用。 */
function CreateLocalDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (input: { label: string; local_path: string }) => Promise<void>
}) {
  const { t } = useTranslation()
  const [label, setLabel] = useState("")
  const [path, setPath] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const valid = label.trim() !== "" && path.trim().startsWith("/")

  const submit = async () => {
    if (!valid || submitting) {
      return
    }
    setSubmitting(true)
    await onCreate({ label: label.trim(), local_path: path.trim() })
    setSubmitting(false)
    setLabel("")
    setPath("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,26rem)] sm:max-w-none">
        <DialogHeader>
          <DialogTitle>{t("storage.newLocal")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="storage-local-name">{t("storage.localName")}</Label>
            <Input
              id="storage-local-name"
              value={label}
              maxLength={100}
              placeholder={t("storage.localNamePlaceholder")}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="storage-local-path">{t("storage.localPath")}</Label>
            <Input
              id="storage-local-path"
              value={path}
              placeholder={t("storage.localPathPlaceholder")}
              className="font-mono"
              onChange={(event) => setPath(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("storage.localPathHint")}
            </p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("common.cancel")}
          </DialogClose>
          <Button disabled={!valid || submitting} onClick={() => void submit()}>
            {t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
