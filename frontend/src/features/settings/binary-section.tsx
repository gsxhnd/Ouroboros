import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { DownloadIcon, RefreshCcwIcon, SaveIcon, TrashIcon } from "lucide-react"
import { toast } from "sonner"

import { ConfirmNameDialog } from "@/components/common/confirm-name-dialog"
import { EmptyHint } from "@/components/common/notes"
import { SelectField } from "@/components/common/select-field"
import { StatusChip } from "@/components/common/status-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { translateOr } from "@/i18n/lookup"
import { SettingsLoading } from "@/features/settings/sections"
import { useSettingsDocument } from "@/features/settings/use-settings"
import { formatBytes } from "@/lib/format"
import { call } from "@/lib/http/client"
import { openEventSource, parseEventPayload } from "@/lib/http/sse"
import { useRcloneStore } from "@/stores/rclone-store"
import type {
  RcloneCandidate,
  RcloneDownloadSnapshot,
  RcloneReleases,
  SettingsDocument,
  SettingsPatchBody,
} from "@/lib/types"
import { cn } from "cn"

/** 已到达终态的下载：不再需要订阅进度，也不会再变化。 */
const TERMINAL_DOWNLOAD_STATUSES: RcloneDownloadSnapshot["status"][] = [
  "completed",
  "failed",
  "cancelled",
]

function isTerminalDownload(snapshot: RcloneDownloadSnapshot): boolean {
  return TERMINAL_DOWNLOAD_STATUSES.includes(snapshot.status)
}

/** 用最新快照替换列表中的同 id 条目（新条目放在最前）。 */
function upsertDownload(
  list: RcloneDownloadSnapshot[],
  snapshot: RcloneDownloadSnapshot
): RcloneDownloadSnapshot[] {
  return [snapshot, ...list.filter((item) => item.id !== snapshot.id)]
}

/**
 * 「rclone 二进制」分区：可执行路径、可用二进制（扫描/选择/删除）与
 * 官方版本下载。下载进度走 SSE 实时更新，完成后可直接激活。
 * 可执行路径表单沿用其余分区的做法：以 updated_at 为 key 重挂载回填服务端值；
 * 扫描结果与下载列表放在外层，选择/删除后不会丢失。
 */
export function BinarySection() {
  const { t, i18n } = useTranslation()
  const { document, load, patch } = useSettingsDocument()
  const [candidates, setCandidates] = useState<RcloneCandidate[]>([])
  const [releases, setReleases] = useState<RcloneReleases | null>(null)
  const [downloadVersion, setDownloadVersion] = useState("")
  const [downloads, setDownloads] = useState<RcloneDownloadSnapshot[]>([])
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<RcloneCandidate | null>(null)
  const streamsRef = useRef(new Map<string, () => void>())

  const rescan = useCallback(async () => {
    try {
      const scan = await call<{ candidates: RcloneCandidate[] }>(
        "/api/rclone/scan",
        { method: "POST", body: {} }
      )
      setCandidates(scan.candidates.filter((candidate) => candidate.valid))
    } catch {
      // call() 已经弹出错误提示。
    }
  }, [])

  // rclone 未运行时拿不到发行版列表：显示占位提示而不是报错。
  const loadReleases = useCallback(async () => {
    try {
      setReleases(await call<RcloneReleases>("/api/rclone/releases"))
    } catch {
      setReleases(null)
    }
  }, [])

  const closeStream = useCallback((id: string) => {
    const close = streamsRef.current.get(id)
    if (close) {
      close()
      streamsRef.current.delete(id)
    }
  }, [])

  /** 开始跟踪一个下载：先记录快照，再订阅它的 SSE 进度事件。 */
  const watchDownload = useCallback(
    (snapshot: RcloneDownloadSnapshot) => {
      setDownloads((current) => upsertDownload(current, snapshot))
      if (isTerminalDownload(snapshot)) {
        return
      }
      const close = openEventSource(
        `/api/rclone/downloads/${encodeURIComponent(snapshot.id)}/events`,
        (_name, raw) => {
          const next = parseEventPayload<RcloneDownloadSnapshot>(raw)
          if (!next) {
            return
          }
          setDownloads((current) => upsertDownload(current, next))
          if (isTerminalDownload(next)) {
            closeStream(next.id)
            if (next.status === "completed") {
              // 新版本落盘后重新扫描，可用二进制里立即出现该版本。
              void rescan()
            }
          }
        }
      )
      streamsRef.current.set(snapshot.id, close)
    },
    [closeStream, rescan]
  )

  // 卸载时关闭所有仍在进行中的下载事件流。
  useEffect(() => {
    const streams = streamsRef.current
    return () => {
      for (const close of streams.values()) {
        close()
      }
    }
  }, [])

  useEffect(() => {
    const run = async () => {
      await rescan()
      await loadReleases()
    }
    void run()
  }, [rescan, loadReleases])

  if (!document) {
    return <SettingsLoading />
  }

  // 与后端的选中逻辑一致：rclone_bin 精确匹配，或回退到系统 PATH。
  const isSelected = (candidate: RcloneCandidate) =>
    document.rclone_bin === candidate.path ||
    (document.rclone_source === "system" &&
      candidate.source === "system" &&
      !document.rclone_bin)

  /** 选择/激活/删除都会改设置文档并影响托管的 rclone，事后同步两处状态。 */
  const refreshAfterChange = async () => {
    void useRcloneStore.getState().refresh()
    await load()
  }

  const selectCandidate = async (candidate: RcloneCandidate) => {
    setBusy(true)
    try {
      await call("/api/rclone/select", {
        method: "POST",
        body: {
          source: candidate.source,
          path: candidate.path,
          version: candidate.version ?? undefined,
        },
      })
      toast.success(t("settings.binarySelected"))
      await refreshAfterChange()
    } catch {
      // call() 已经弹出错误提示。
    } finally {
      setBusy(false)
    }
  }

  const activateVersion = async (version: string) => {
    setBusy(true)
    try {
      await call(
        `/api/rclone/versions/${encodeURIComponent(version)}/activate`,
        {
          method: "POST",
        }
      )
      toast.success(t("settings.activated", { version }))
      await refreshAfterChange()
    } catch {
      // call() 已经弹出错误提示。
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    const target = deleteTarget
    if (!target?.version) {
      return
    }
    setBusy(true)
    try {
      await call(`/api/rclone/versions/${encodeURIComponent(target.version)}`, {
        method: "DELETE",
      })
      toast.success(t("settings.versionDeleted", { version: target.version }))
      setDeleteTarget(null)
      await rescan()
      await refreshAfterChange()
    } catch {
      // call() 已经弹出错误提示。
    } finally {
      setBusy(false)
    }
  }

  const startDownload = async () => {
    const version = downloadVersion.trim() || releases?.releases[0]?.version
    if (!version) {
      toast.error(t("settings.noVersions"))
      return
    }
    setBusy(true)
    try {
      const snapshot = await call<RcloneDownloadSnapshot>(
        "/api/rclone/downloads",
        { method: "POST", body: { version } }
      )
      watchDownload(snapshot)
    } catch {
      // call() 已经弹出错误提示。
    } finally {
      setBusy(false)
    }
  }

  const cancelDownload = async (id: string) => {
    try {
      const snapshot = await call<RcloneDownloadSnapshot>(
        `/api/rclone/downloads/${encodeURIComponent(id)}/cancel`,
        { method: "POST" }
      )
      setDownloads((current) => upsertDownload(current, snapshot))
      if (isTerminalDownload(snapshot)) {
        closeStream(snapshot.id)
      }
    } catch {
      // call() 已经弹出错误提示。
    }
  }

  const releaseList = releases?.releases ?? []
  const upgradeAvailable =
    releases?.current != null &&
    releases.current !== "" &&
    releaseList[0] != null &&
    releaseList[0].version !== releases.current

  return (
    <>
      <BinPathForm
        key={document.updated_at}
        document={document}
        onPatch={patch}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.scanTitle")}</CardTitle>
          <CardDescription>{t("settings.scanDescription")}</CardDescription>
          <CardAction>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label={t("common.refresh")}
              title={t("common.refresh")}
              onClick={() => void rescan()}
            >
              <RefreshCcwIcon />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {candidates.length === 0 ? (
            <EmptyHint>{t("settings.noBinary")}</EmptyHint>
          ) : (
            candidates.map((candidate) => (
              <div
                key={`${candidate.source}:${candidate.path}`}
                className={cn(
                  "flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm",
                  isSelected(candidate) && "ring-1 ring-primary/40"
                )}
              >
                <Badge variant="outline">
                  {translateOr(
                    i18n,
                    `settings.source.${candidate.source}`,
                    candidate.source
                  )}
                </Badge>
                <span
                  className="min-w-0 flex-1 truncate font-mono text-xs"
                  title={candidate.path}
                >
                  {candidate.path}
                </span>
                {candidate.version ? (
                  <Badge variant="secondary">{candidate.version}</Badge>
                ) : null}
                <Button
                  size="sm"
                  variant={isSelected(candidate) ? "secondary" : "outline"}
                  disabled={busy}
                  onClick={() => void selectCandidate(candidate)}
                >
                  {isSelected(candidate)
                    ? t("common.current")
                    : t("common.choose")}
                </Button>
                {candidate.source === "managed" ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    aria-label={t("common.delete")}
                    title={t("common.delete")}
                    disabled={busy}
                    onClick={() => setDeleteTarget(candidate)}
                  >
                    <TrashIcon />
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.downloadTitle")}</CardTitle>
          <CardDescription>{t("settings.downloadDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {releases?.current ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs text-muted-foreground">
                {t("settings.currentVersion")}
              </span>
              <Badge variant="secondary">{releases.current}</Badge>
              {upgradeAvailable ? (
                <Badge variant="outline">
                  {t("settings.upgradeHint", {
                    version: releaseList[0].version,
                  })}
                </Badge>
              ) : null}
            </div>
          ) : null}
          {releaseList.length === 0 ? (
            <EmptyHint>
              {releases
                ? t("settings.noReleases")
                : t("settings.releasesUnavailable")}
            </EmptyHint>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <SelectField
                label={t("settings.downloadVersion")}
                className="w-48"
                value={
                  releaseList.some((r) => r.version === downloadVersion)
                    ? downloadVersion
                    : ""
                }
                placeholder={
                  releaseList[0]?.version ?? t("settings.noReleases")
                }
                options={releaseList.map((r) => ({
                  value: r.version,
                  label: r.version,
                }))}
                onChange={setDownloadVersion}
                disabled={releaseList.length === 0}
              />
              <Button
                size="sm"
                disabled={busy || releaseList.length === 0}
                onClick={() => void startDownload()}
              >
                <DownloadIcon data-icon="inline-start" />
                {t("settings.download")}
              </Button>
            </div>
          )}
          {downloads.map((download) => (
            <DownloadRow
              key={download.id}
              download={download}
              disabled={busy}
              onCancel={() => void cancelDownload(download.id)}
              onActivate={() => void activateVersion(download.version)}
            />
          ))}
        </CardContent>
      </Card>

      <ConfirmNameDialog
        open={deleteTarget !== null}
        title={t("settings.deleteVersionTitle")}
        warning={
          deleteTarget
            ? t("settings.deleteVersionWarning", {
                version: deleteTarget.version ?? "",
              })
            : ""
        }
        expectedName={deleteTarget?.version ?? null}
        confirmLabel={t("common.delete")}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}

/** 可执行路径表单：从「运行环境」分区迁移而来，保存后回填服务端最新值。 */
function BinPathForm({
  document,
  onPatch,
}: {
  document: SettingsDocument
  onPatch: (body: SettingsPatchBody) => Promise<SettingsDocument>
}) {
  const { t } = useTranslation()
  const [bin, setBin] = useState(document.rclone_bin ?? "")

  const saveBin = async () => {
    try {
      await onPatch({ rclone_bin: bin.trim() || null })
    } catch {
      return
    }
    toast.success(t("settings.binSaved"))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.binaryTitle")}</CardTitle>
        <CardDescription>
          {t("settings.binaryDescription", {
            source: document.rclone_source,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-64 flex-1 flex-col gap-1.5">
            <Label htmlFor="settings-bin">{t("settings.binaryPath")}</Label>
            <Input
              id="settings-bin"
              className="font-mono"
              value={bin}
              placeholder="rclone"
              onChange={(event) => setBin(event.target.value)}
            />
          </div>
          <Button size="sm" variant="outline" onClick={() => void saveBin()}>
            <SaveIcon data-icon="inline-start" />
            {t("common.save")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("settings.binarySwitchHint")}
        </p>
      </CardContent>
    </Card>
  )
}

/** 单个下载条目：进行中可取消，完成后可直接激活。 */
function DownloadRow({
  download,
  disabled,
  onCancel,
  onActivate,
}: {
  download: RcloneDownloadSnapshot
  disabled: boolean
  onCancel: () => void
  onActivate: () => void
}) {
  const { t } = useTranslation()
  const percent =
    download.total_bytes && download.total_bytes > 0
      ? Math.min(100, Math.round((download.bytes / download.total_bytes) * 100))
      : null
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline">{download.version}</Badge>
        <StatusChip status={download.status} />
        <span className="text-xs text-muted-foreground">
          {formatBytes(download.bytes)}
          {download.total_bytes
            ? ` / ${formatBytes(download.total_bytes)}`
            : ""}
        </span>
        {download.error ? (
          <span className="text-xs text-destructive">{download.error}</span>
        ) : null}
        <div className="ml-auto flex gap-1.5">
          {!isTerminalDownload(download) ? (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={onCancel}
            >
              {t("common.cancel")}
            </Button>
          ) : null}
          {download.status === "completed" ? (
            <Button size="sm" disabled={disabled} onClick={onActivate}>
              {t("settings.activate")}
            </Button>
          ) : null}
        </div>
      </div>
      {percent !== null ? <Progress value={percent} /> : null}
    </div>
  )
}
