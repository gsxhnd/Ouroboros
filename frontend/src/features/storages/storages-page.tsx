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

import { ConfirmNameDialog } from "@/components/common/confirm-name-dialog"
import { CreateLocalDialog } from "@/features/storages/components/create-local-dialog"
import { RemoteFormDialog } from "@/features/storages/remote-form/remote-form-dialog"
import { EmptyHint, LoadingBlock, WarningNote } from "@/components/common/notes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  PageContainer,
  PageHeader,
  SectionHeading,
} from "@/components/common/page-header"
import type { StorageNode } from "@/lib/types"
import { useStorageStore } from "@/features/storages/storage-store"
import { providerLabel } from "@/features/storages/remote-form/provider-label"
import { useRcloneStore } from "@/stores/rclone-store"

type DeleteTarget =
  | { kind: "local"; node: StorageNode }
  | { kind: "remote"; name: string }
  | null

export function StoragesPage() {
  const { t } = useTranslation()
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

      <section className="flex flex-col gap-3">
        <SectionHeading
          title={t("storage.localSection")}
          icon={
            <HardDriveIcon
              className="size-4 text-muted-foreground"
              aria-hidden
            />
          }
          actions={
            <Button size="sm" onClick={() => setLocalOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              {t("storage.newLocal")}
            </Button>
          }
        />
        {!loaded ? (
          <LoadingBlock>{t("storage.loading")}</LoadingBlock>
        ) : localNodes.length === 0 ? (
          <EmptyHint>{t("storage.localEmpty")}</EmptyHint>
        ) : (
          <Card className="py-0">
            <CardContent className="p-0">
              {localNodes.map((node, index) => {
                const used = usageCount(node.id)
                return (
                  <div key={node.id}>
                    {index > 0 ? <Separator /> : null}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <HardDriveIcon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
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
                        onClick={() => setDeleteTarget({ kind: "local", node })}
                      >
                        <TrashIcon />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading
          title={t("storage.remoteSection")}
          icon={
            <CloudIcon className="size-4 text-muted-foreground" aria-hidden />
          }
          actions={
            <Button
              size="sm"
              onClick={() => {
                setEditingRemote(null)
                setRemoteDialogOpen(true)
              }}
            >
              <PlusIcon data-icon="inline-start" />
              {t("storage.newRemote")}
            </Button>
          }
        />
        {!rcloneRunning ? (
          <WarningNote>{t("storage.rcloneOfflineRemotes")}</WarningNote>
        ) : remotes.length === 0 ? (
          <EmptyHint>{t("storage.remoteEmpty")}</EmptyHint>
        ) : (
          <Card className="py-0">
            <CardContent className="p-0">
              {remotes.map((remote, index) => (
                <div key={remote.name}>
                  {index > 0 ? <Separator /> : null}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <CloudIcon
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate font-mono text-sm font-medium">
                        {remote.name}
                      </span>
                      <Badge variant="secondary" className="font-normal">
                        {providerLabel(remote.type)}
                      </Badge>
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
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
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
