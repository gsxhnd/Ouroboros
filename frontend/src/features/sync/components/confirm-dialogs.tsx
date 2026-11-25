import { useTranslation } from "react-i18next"

import { WarningNote } from "@/components/common/notes"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { bisyncNeedsResync, endpointLabel } from "@/features/sync/labels"
import type { SyncTask } from "@/lib/types"

/** 运行确认：展示源、目标和影响，满足危险操作的确认要求。 */
export function RunConfirmDialog({
  task,
  onClose,
  onConfirm,
}: {
  task: SyncTask | null
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const resync = task ? bisyncNeedsResync(task) : false
  const impactKey =
    task?.operation === "bisync"
      ? "sync.impactBisync"
      : task?.operation === "move"
        ? "sync.impactMove"
        : "sync.impactSync"
  const hintKey =
    task?.operation === "bisync"
      ? resync
        ? "sync.resyncWarning"
        : "sync.bisyncWarning"
      : task?.operation === "sync"
        ? "sync.opSyncHint"
        : task?.operation === "move"
          ? "sync.opMoveHint"
          : null

  return (
    <Dialog open={task !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(92vw,30rem)] sm:max-w-none">
        <DialogHeader>
          <DialogTitle>
            {resync ? t("sync.resyncTitle") : t("sync.runConfirmTitle")}
          </DialogTitle>
        </DialogHeader>
        {task ? (
          <div className="flex flex-col gap-3 text-sm">
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 rounded-lg bg-muted px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">
                {t("sync.source")}
              </dt>
              <dd className="truncate font-mono text-xs">
                {endpointLabel(task.source)}
              </dd>
              <dt className="text-xs text-muted-foreground">
                {t("sync.target")}
              </dt>
              <dd className="truncate font-mono text-xs">
                {endpointLabel(task.target)}
              </dd>
            </dl>
            <p className="leading-relaxed">{t(impactKey)}</p>
            {hintKey ? <WarningNote>{t(hintKey)}</WarningNote> : null}
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("common.cancel")}
          </DialogClose>
          <Button variant="destructive" onClick={onConfirm}>
            {resync ? t("sync.resyncAction") : t("sync.runNow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** 手动 resync 的独立确认：双向同步会双向传播删除。 */
export function ResyncConfirmDialog({
  task,
  onClose,
  onConfirm,
}: {
  task: SyncTask | null
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={task !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(92vw,28rem)] sm:max-w-none">
        <DialogHeader>
          <DialogTitle>{t("sync.resyncTitle")}</DialogTitle>
        </DialogHeader>
        <div className="text-sm leading-relaxed text-muted-foreground">
          {t("sync.resyncWarning")}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("common.cancel")}
          </DialogClose>
          <Button variant="destructive" onClick={onConfirm}>
            {t("sync.resyncAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
