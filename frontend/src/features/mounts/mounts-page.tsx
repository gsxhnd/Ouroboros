import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { ConfirmNameDialog } from "@/components/common/confirm-name-dialog"
import { EmptyHint, LoadingBlock, WarningNote } from "@/components/common/notes"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MountCard, mountTitle } from "@/features/mounts/components/mount-card"
import { MountDialog } from "@/features/mounts/components/mount-dialog"
import { subscribeMounts, useMountStore } from "@/features/mounts/mount-store"
import { endpointLabel } from "@/features/sync/labels"
import { callQuiet } from "@/lib/http/client"
import type { MountTask, RemoteInfo } from "@/lib/types"
import { useRcloneStore } from "@/stores/rclone-store"

export function MountsPage() {
  const { t } = useTranslation()
  const mounts = useMountStore((state) => state.mounts)
  const snapshots = useMountStore((state) => state.snapshots)
  const loaded = useMountStore((state) => state.loaded)
  const error = useMountStore((state) => state.error)
  const load = useMountStore((state) => state.load)
  const deleteMount = useMountStore((state) => state.deleteMount)
  const startMount = useMountStore((state) => state.startMount)
  const stopMount = useMountStore((state) => state.stopMount)
  const rcloneRunning = useRcloneStore(
    (state) => state.status?.running ?? false
  )

  const [remotes, setRemotes] = useState<RemoteInfo[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [startConfirm, setStartConfirm] = useState<MountTask | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<MountTask | null>(null)
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set())

  useEffect(() => {
    void load()
    void callQuiet<{ remotes: RemoteInfo[] }>("/api/remotes")
      .then((data) => setRemotes(data.remotes))
      .catch(() => setRemotes([]))
    return subscribeMounts()
  }, [load])

  const markPending = (id: string, active: boolean) => {
    setPending((current) => {
      const next = new Set(current)
      if (active) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  const confirmStart = async (mount: MountTask) => {
    setStartConfirm(null)
    markPending(mount.id, true)
    try {
      const snapshot = await startMount(mount.id)
      if (snapshot.status === "failed") {
        toast.error(snapshot.error || t("mounts.failed"))
        return
      }
      toast.success(t("mounts.started", { name: mountTitle(mount) }))
    } catch {
      // call() 已经弹出错误提示。
    } finally {
      markPending(mount.id, false)
    }
  }

  const stop = async (mount: MountTask) => {
    markPending(mount.id, true)
    try {
      await stopMount(mount.id)
      toast.success(t("mounts.unmounted", { name: mountTitle(mount) }))
    } catch {
      // call() 已经弹出错误提示。
    } finally {
      markPending(mount.id, false)
    }
  }

  const confirmDelete = async (mount: MountTask) => {
    setDeleteConfirm(null)
    try {
      await deleteMount(mount.id)
    } catch {
      return
    }
    toast.success(t("mounts.deleteDone", { name: mountTitle(mount) }))
  }

  const deleteLabel = deleteConfirm ? mountTitle(deleteConfirm) : ""

  return (
    <PageContainer>
      <PageHeader
        title={t("nav.mounts")}
        description={t("nav.mountsHint")}
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            {t("mounts.new")}
          </Button>
        }
      />

      {!rcloneRunning ? (
        <WarningNote>{t("mounts.rcloneOffline")}</WarningNote>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!loaded ? (
        <LoadingBlock>{t("mounts.loading")}</LoadingBlock>
      ) : mounts.length === 0 ? (
        <EmptyHint>{t("mounts.empty")}</EmptyHint>
      ) : (
        mounts.map((mount) => (
          <MountCard
            key={mount.id}
            mount={mount}
            snapshot={snapshots.find((item) => item.edge_id === mount.id)}
            pending={pending.has(mount.id)}
            onStart={() => setStartConfirm(mount)}
            onStop={() => void stop(mount)}
            onDelete={() => setDeleteConfirm(mount)}
          />
        ))
      )}

      <MountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        remotes={remotes}
      />

      <MountStartDialog
        mount={startConfirm}
        onClose={() => setStartConfirm(null)}
        onConfirm={() => {
          if (startConfirm) {
            void confirmStart(startConfirm)
          }
        }}
      />

      <ConfirmNameDialog
        open={deleteConfirm !== null}
        title={t("mounts.deleteTitle")}
        warning={t("mounts.deleteWarning", { name: deleteLabel })}
        expectedName={deleteConfirm ? deleteLabel : null}
        confirmLabel={t("common.delete")}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) {
            void confirmDelete(deleteConfirm)
          }
        }}
      />
    </PageContainer>
  )
}

/** 挂载前确认：展示源、目标和「改动会写回远程」的影响。 */
function MountStartDialog({
  mount,
  onClose,
  onConfirm,
}: {
  mount: MountTask | null
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={mount !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(92vw,30rem)] sm:max-w-none">
        <DialogHeader>
          <DialogTitle>{t("mounts.startTitle")}</DialogTitle>
        </DialogHeader>
        {mount ? (
          <div className="flex flex-col gap-3 text-sm">
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 rounded-lg bg-muted px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">
                {t("mounts.source")}
              </dt>
              <dd className="truncate font-mono text-xs">
                {endpointLabel(mount.source)}
              </dd>
              <dt className="text-xs text-muted-foreground">
                {t("mounts.target")}
              </dt>
              <dd className="truncate font-mono text-xs">
                {endpointLabel(mount.target)}
              </dd>
            </dl>
            <WarningNote>{t("mounts.impact")}</WarningNote>
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("common.cancel")}
          </DialogClose>
          <Button variant="destructive" onClick={onConfirm}>
            {t("mounts.start")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
