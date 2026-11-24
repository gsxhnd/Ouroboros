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

import { ConfirmNameDialog } from "@/components/confirm-name-dialog"
import { CreateLocalDialog } from "@/components/storages/create-local-dialog"
import { RemoteFormDialog } from "@/components/remote-form-dialog"
import { EmptyHint, WarningNote } from "@/components/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageContainer, PageHeader } from "@/components/page-header"
import type { StorageNode } from "@/lib/types"
import { useStorageStore } from "@/stores/storage-store"
import { useRcloneStore } from "@/stores/rclone-store"

type DeleteTarget =
  | { kind: "local"; node: StorageNode }
  | { kind: "remote"; name: string }
  | null

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

  const confirmDelete = async () => {
    const target = deleteTarget
    if (!target) {
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

  const deleteWarning = (target: DeleteTarget) =>
    target?.kind === "remote"
      ? t("storage.deleteRemoteWarning", { name: target.name })
      : target?.kind === "local"
        ? t("storage.deleteLocalWarning", {
            name: target.node.label,
            path: target.node.local_path,
          })
        : ""

  return (
    <PageContainer>
      <PageHeader
        title={t("storage.title")}
        description={t("storage.subtitle")}
      />

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
              <Card key={node.id} className="py-2.5">
                <CardContent className="flex items-center gap-3 px-4">
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
                    onClick={() =>
                      setDeleteTarget({ kind: "local", node })
                    }
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
          <WarningNote>{t("storage.rcloneOfflineRemotes")}</WarningNote>
        ) : remotes.length === 0 ? (
          <EmptyHint>{t("storage.remoteEmpty")}</EmptyHint>
        ) : (
          remotes.map((remote) => (
            <Card key={remote.name} className="py-2.5">
              <CardContent className="flex items-center gap-3 px-4">
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
                    setDeleteTarget({ kind: "remote", name: remote.name })
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

      <ConfirmNameDialog
        open={deleteTarget !== null}
        title={t("storage.deleteTitle")}
        warning={deleteWarning(deleteTarget)}
        // remote 删除会连带 rclone 凭据，必须输入名称确认；本地存储用普通确认。
        expectedName={
          deleteTarget?.kind === "remote" ? deleteTarget.name : null
        }
        confirmLabel={t("common.delete")}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </PageContainer>
  )
}
