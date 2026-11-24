import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2Icon, PlayIcon, SquareIcon } from "lucide-react"
import { Events } from "@wailsio/runtime"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { call, callQuiet } from "@/lib/client"
import { openEventSource, parseEventPayload } from "@/lib/api"
import { useRcloneStore } from "@/stores/rclone-store"
import { useWorkspace } from "@/stores/workspace"
import type {
  JobSnapshot,
  MountSnapshot,
  SettingsDocument,
  StorageNode,
} from "@/lib/types"
import { cn } from "cn"

/** 托盘面板 → Go 事件名，需与 cmd/desktop/tray.go 保持一致。 */
const TRAY_OPEN_MAIN = "ourboros:tray:open-main"
const TRAY_QUIT = "ourboros:tray:quit"
const TRAY_AUTOSTART = "ourboros:tray:autostart"
const MAX_ROWS = 5
const TERMINAL_JOB: ReadonlySet<string> = new Set([
  "succeeded",
  "failed",
  "partial_failed",
  "cancelled",
  "expired",
])

function nodeLabel(nodes: StorageNode[], id: string): string {
  const node = nodes.find((item) => item.id === id)
  if (!node) {
    return id
  }
  return node.kind === "local" && node.local_path ? node.local_path : node.label
}

export function TrayPanel() {
  const { t } = useTranslation()
  const { doc, reload } = useWorkspace()
  const status = useRcloneStore((state) => state.status)
  const busy = useRcloneStore((state) => state.busy)
  const start = useRcloneStore((state) => state.start)
  const stop = useRcloneStore((state) => state.stop)
  const refreshStatus = useRcloneStore((state) => state.refresh)
  const [mounts, setMounts] = useState<MountSnapshot[]>([])
  const [jobs, setJobs] = useState<JobSnapshot[]>([])
  const [autoStart, setAutoStart] = useState(false)
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set())

  const loadMounts = useCallback(async () => {
    try {
      const data = await callQuiet<{ mounts: MountSnapshot[] }>("/api/mounts")
      setMounts(data.mounts)
    } catch {
      setMounts([])
    }
  }, [])

  const loadJobs = useCallback(async () => {
    try {
      const data = await callQuiet<{ jobs: JobSnapshot[] }>("/api/sync/jobs")
      setJobs(data.jobs)
    } catch {
      setJobs([])
    }
  }, [])

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await callQuiet<SettingsDocument>("/api/settings")
        setAutoStart(data.auto_start)
      } catch {
        // 保持上一次的开关状态。
      }
    }
    const run = async () => {
      await Promise.all([loadMounts(), loadJobs(), loadSettings()])
    }
    void run()
    const timer = window.setInterval(() => {
      void refreshStatus()
      void loadJobs()
    }, 2000)
    const closeMounts = openEventSource(
      "/api/mounts/events",
      (_name, raw) => {
        const snapshot = parseEventPayload<MountSnapshot>(raw)
        if (!snapshot) {
          void loadMounts()
          return
        }
        setMounts((current) => [
          ...current.filter((m) => m.edge_id !== snapshot.edge_id),
          snapshot,
        ])
      },
      undefined,
      () => void loadMounts()
    )
    return () => {
      window.clearInterval(timer)
      closeMounts()
    }
  }, [loadMounts, loadJobs, refreshStatus])

  const nodes = doc?.nodes ?? []
  const mountEdges = (doc?.edges ?? []).filter((edge) => edge.kind === "mount")
  const mountedCount = mounts.filter((m) => m.status === "mounted").length
  const runningJobs = jobs.filter((job) => !TERMINAL_JOB.has(job.status))
  const running = status?.running ?? false
  const offline = status === null

  const toggleMount = async (edgeId: string, mounted: boolean) => {
    setPending((current) => new Set(current).add(edgeId))
    try {
      const path = `/api/mounts/${encodeURIComponent(edgeId)}/${mounted ? "stop" : "start"}`
      const snapshot = await call<MountSnapshot>(path, { method: "POST", body: {} })
      setMounts((current) => [
        ...current.filter((m) => m.edge_id !== snapshot.edge_id),
        snapshot,
      ])
    } catch {
      // call() 已经弹出错误提示。
    } finally {
      setPending((current) => {
        const next = new Set(current)
        next.delete(edgeId)
        return next
      })
    }
  }

  const toggleAutoStart = async (enable: boolean) => {
    try {
      await call<SettingsDocument>("/api/settings", {
        method: "PATCH",
        body: { auto_start: enable },
      })
      setAutoStart(enable)
      void Events.Emit(TRAY_AUTOSTART, enable)
    } catch {
      // call() 已经弹出错误提示。
    }
  }

  const stopJob = async (jobId: string) => {
    try {
      await call(`/api/sync/jobs/${encodeURIComponent(jobId)}/stop`, {
        method: "POST",
        body: {},
      })
      void loadJobs()
    } catch {
      // call() 已经弹出错误提示。
    }
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden rounded-xl border bg-popover text-sm text-popover-foreground select-none [--wails-draggable:no-drag]">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5 [--wails-draggable:drag]">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="grid size-6 shrink-0 place-items-center rounded-md bg-primary text-[10px] font-semibold text-primary-foreground"
            aria-hidden
          >
            O
          </span>
          <div className="min-w-0">
            <div className="truncate font-heading text-sm font-semibold">Ourboros</div>
            <div className="truncate text-xs text-muted-foreground">
              {offline
                ? t("tray.offline")
                : running
                  ? t("tray.running")
                  : t("tray.stopped")}
            </div>
          </div>
        </div>
        <Badge variant="outline" className="font-normal">
          {offline ? t("shell.offline") : running ? t("shell.running") : t("shell.stopped")}
        </Badge>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {!offline ? (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void (running ? stop() : start())}
            className="w-full justify-center"
          >
            {busy ? (
              <Loader2Icon className="animate-spin" />
            ) : running ? (
              <SquareIcon />
            ) : (
              <PlayIcon />
            )}
            {running ? t("shell.stopRclone") : t("shell.startRclone")}
          </Button>
        ) : null}

        <section className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("tray.mounts")}</span>
            <span>{t("tray.mountedCount", { count: mountedCount })}</span>
          </div>
          {mountEdges.length === 0 ? (
            <p className="rounded-md bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground">
              {t("tray.noMounts")}
            </p>
          ) : (
            mountEdges.slice(0, MAX_ROWS).map((edge) => {
              const snapshot = mounts.find((m) => m.edge_id === edge.id)
              const mounted = snapshot?.status === "mounted"
              const inFlight =
                pending.has(edge.id) ||
                snapshot?.status === "starting" ||
                snapshot?.status === "stopping"
              return (
                <div
                  key={edge.id}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">
                      {nodeLabel(nodes, edge.source)} → {nodeLabel(nodes, edge.target)}
                    </div>
                    {snapshot?.status === "failed" ? (
                      <div className="truncate text-[11px] text-destructive">
                        {t("tray.mountFailed")}
                      </div>
                    ) : null}
                  </div>
                  <Button
                    variant={mounted ? "secondary" : "outline"}
                    size="xs"
                    disabled={inFlight}
                    onClick={() => void toggleMount(edge.id, mounted)}
                  >
                    {inFlight ? <Loader2Icon className="animate-spin" /> : null}
                    {mounted ? t("tray.unmount") : t("tray.mount")}
                  </Button>
                </div>
              )
            })
          )}
        </section>

        <section className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("tray.jobs")}</span>
            <span>{t("tray.runningCount", { count: runningJobs.length })}</span>
          </div>
          {runningJobs.length === 0 ? (
            <p className="rounded-md bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground">
              {t("tray.noJobs")}
            </p>
          ) : (
            <>
              {runningJobs.slice(0, MAX_ROWS).map((job) => (
                <div
                  key={job.id}
                  className={cn(
                    "flex flex-col gap-1 rounded-md px-2 py-1.5 hover:bg-accent"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium">
                      {job.operation}
                      {job.progress.percentage > 0
                        ? ` · ${job.progress.percentage.toFixed(0)}%`
                        : ""}
                    </span>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => void stopJob(job.id)}
                    >
                      {t("tray.stopJob")}
                    </Button>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-[width]"
                      style={{ width: `${Math.min(100, job.progress.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
              {runningJobs.length > MAX_ROWS ? (
                <p className="px-2 text-xs text-muted-foreground">
                  {t("tray.moreJobs", { count: runningJobs.length - MAX_ROWS })}
                </p>
              ) : null}
            </>
          )}
        </section>
      </div>

      <footer className="flex shrink-0 flex-col gap-1 border-t px-3 py-2">
        <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1 text-xs hover:bg-accent">
          <span>{t("tray.autoStart")}</span>
          <input
            type="checkbox"
            className="size-3.5 accent-primary"
            checked={autoStart}
            onChange={(event) => void toggleAutoStart(event.target.checked)}
          />
        </label>
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="xs" onClick={() => void reload()}>
            {t("tray.refresh")}
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="xs" onClick={() => void Events.Emit(TRAY_OPEN_MAIN)}>
              {t("tray.openMain")}
            </Button>
            <Button variant="ghost" size="xs" onClick={() => void Events.Emit(TRAY_QUIT)}>
              {t("tray.quit")}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}
