import { useTranslation } from "react-i18next"
import {
  ArrowRightIcon,
  CopyIcon,
  PlayIcon,
  SquareIcon,
  TrashIcon,
} from "lucide-react"
import { toast } from "sonner"

import { StatusChip } from "@/components/common/status-chip"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { endpointLabel } from "@/features/sync/labels"
import type { MountSnapshot, MountTask } from "@/lib/types"

const ACTIVE = new Set(["starting", "mounted", "stopping"])

export function mountTitle(mount: MountTask): string {
  const name = mount.name.trim()
  if (name) {
    return name
  }
  return `${endpointLabel(mount.source)} → ${endpointLabel(mount.target)}`
}

export function mountIsActive(status: string): boolean {
  return ACTIVE.has(status)
}

/** 一条挂载：名称、remote → 本地目录、运行状态，以及挂载 / 卸载 / 删除。 */
export function MountCard({
  mount,
  snapshot,
  pending,
  onStart,
  onStop,
  onDelete,
}: {
  mount: MountTask
  snapshot: MountSnapshot | undefined
  pending: boolean
  onStart: () => void
  onStop: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const status = snapshot?.status ?? "stopped"
  const busy = pending || status === "starting" || status === "stopping"
  const mounted = status === "mounted"
  const active = mountIsActive(status)

  const copyError = async () => {
    const message = snapshot?.error
    if (!message) {
      return
    }
    try {
      await navigator.clipboard.writeText(message)
      toast.success(t("mounts.errorCopied"))
    } catch {
      toast.error(t("errors.requestFailed"))
    }
  }

  return (
    <Card className="py-0">
      <CardContent className="flex flex-col px-0">
        <div className="flex flex-col gap-3 px-4 py-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">
              {mountTitle(mount)}
            </span>
            <StatusChip status={status} />
            {snapshot?.exit_code !== undefined ? (
              <span className="text-xs text-muted-foreground">
                {t("mounts.exitCode", { code: snapshot.exit_code })}
              </span>
            ) : null}
          </div>

          <div className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-xs">
              {endpointLabel(mount.source)}
            </span>
            <ArrowRightIcon
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate font-mono text-xs">
              {endpointLabel(mount.target)}
            </span>
          </div>

          {snapshot?.error ? (
            <div className="flex items-start gap-2 text-xs text-destructive">
              <p className="min-w-0 flex-1 break-all">{snapshot.error}</p>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={t("mounts.copyError")}
                title={t("mounts.copyError")}
                onClick={() => void copyError()}
              >
                <CopyIcon />
              </Button>
            </div>
          ) : null}
        </div>

        <Separator />
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          {mounted ? (
            <Button
              size="xs"
              variant="outline"
              disabled={busy}
              onClick={onStop}
            >
              {busy ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <SquareIcon data-icon="inline-start" />
              )}
              {t("mounts.unmount")}
            </Button>
          ) : (
            <Button size="xs" disabled={busy} onClick={onStart}>
              {busy ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <PlayIcon data-icon="inline-start" />
              )}
              {t("mounts.start")}
            </Button>
          )}
          <span className="ms-auto">
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={t("common.delete")}
              title={active ? t("mounts.unmountFirst") : t("common.delete")}
              disabled={active || busy}
              onClick={onDelete}
            >
              <TrashIcon />
            </Button>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
