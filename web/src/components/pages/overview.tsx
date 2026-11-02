import { useCallback, useEffect, useState } from "react"
import { DownloadIcon, PlayIcon, SquareIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyHint, SelectField, StatusChip } from "@/components/shared"
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

import { call, formatBytes } from "@/lib/client"
import type { HttpMethod } from "@/lib/api"
import { useRcloneStore } from "@/lib/rclone-store"
import type { RcloneStatus, SettingsDocument } from "@/lib/types"

type Candidate = {
  source: "system" | "managed" | "custom"
  path: string
  version: string | null
  valid: boolean
  managed: boolean
  error: string | null
}

type Release = { version: string; filename: string; url: string }

type DownloadSnapshot = {
  id: string
  version: string
  status:
    | "queued"
    | "downloading"
    | "verifying"
    | "extracting"
    | "completed"
    | "failed"
    | "cancelled"
  bytes: number
  total_bytes: number | null
  error?: string
}

export function OverviewPage() {
  const status = useRcloneStore((state) => state.status)
  const rcloneBusy = useRcloneStore((state) => state.busy)
  const startRclone = useRcloneStore((state) => state.start)
  const stopRclone = useRcloneStore((state) => state.stop)
  const [settings, setSettings] = useState<SettingsDocument | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [releases, setReleases] = useState<Release[]>([])
  const [busy, setBusy] = useState(false)
  const [downloadVersion, setDownloadVersion] = useState("")
  const [downloads, setDownloads] = useState<DownloadSnapshot[]>([])

  const load = useCallback(async () => {
    try {
      setSettings(await call<SettingsDocument>("/api/settings"))
      const scan = await call<{ candidates: Candidate[] }>("/api/rclone/scan", {
        method: "POST",
        body: {},
      })
      setCandidates(scan.candidates.filter((c) => c.valid))
      try {
        const data = await call<{ releases: Release[] }>("/api/rclone/releases")
        setReleases(data.releases)
      } catch {
        setReleases([])
      }
    } catch {
      // call() 已经弹出错误提示。
    }
  }, [])

  useEffect(() => {
    const run = async () => {
      await load()
    }
    void run()
  }, [load])

  const fire = async (
    path: string,
    next: { method?: HttpMethod; body?: unknown }
  ) => {
    setBusy(true)
    try {
      await call(path, next)
      await load()
    } catch {
      // call() 已经弹出错误提示。
    } finally {
      setBusy(false)
    }
  }

  const startDownload = async () => {
    const version = downloadVersion.trim() || releases[0]?.version
    if (!version) {
      toast.error("没有可用的版本")
      return
    }
    setBusy(true)
    try {
      const snapshot = await call<DownloadSnapshot>("/api/rclone/downloads", {
        method: "POST",
        body: { version },
      })
      setDownloads((current) => [
        snapshot,
        ...current.filter((d) => d.id !== snapshot.id),
      ])
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>rclone 连接</CardTitle>
          <CardDescription>
            默认不会自动拉起。连接成功后，这里会显示版本、系统和地址。
          </CardDescription>
          <CardAction>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={rcloneBusy || status === null || status.running}
                onClick={() => void startRclone()}
              >
                <PlayIcon data-icon="inline-start" /> 启动 / 连接
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={rcloneBusy || status === null || !status.running}
                onClick={() => void stopRclone()}
              >
                <SquareIcon data-icon="inline-start" /> 停止
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={status?.running ? "running" : "stopped"} />
            {status?.mode ? (
              <Badge variant="outline">{modeLabel(status.mode)}</Badge>
            ) : null}
            {status?.version ? (
              <Badge variant="secondary">{status.version}</Badge>
            ) : null}
            {status?.beta ? <Badge variant="outline">beta</Badge> : null}
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            {connectionFacts(status).map((fact) => (
              <div key={fact.label} className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                <dd className="truncate font-mono text-xs" title={fact.value}>
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>rclone 二进制</CardTitle>
          <CardDescription>
            选择本次使用哪个 rclone 可执行文件。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {candidates.length === 0 ? (
            <EmptyHint>没有扫描到可用的 rclone，安装或下载后重试。</EmptyHint>
          ) : (
            candidates.map((candidate) => {
              const selected =
                settings?.rclone_bin === candidate.path ||
                (settings?.rclone_source === "system" &&
                  candidate.source === "system" &&
                  !settings?.rclone_bin)
              return (
                <div
                  key={`${candidate.source}:${candidate.path}`}
                  className="flex flex-wrap items-center gap-2 rounded-xl bg-background px-3 py-2.5 text-sm ring-1 ring-foreground/10"
                >
                  <Badge variant="outline">{candidate.source}</Badge>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">
                    {candidate.path}
                  </span>
                  {candidate.version ? (
                    <Badge variant="secondary">{candidate.version}</Badge>
                  ) : null}
                  <Button
                    size="sm"
                    variant={selected ? "secondary" : "outline"}
                    disabled={busy}
                    onClick={() =>
                      void fire("/api/rclone/select", {
                        method: "POST",
                        body: {
                          source: candidate.source,
                          path: candidate.path,
                          version: candidate.version ?? undefined,
                        },
                      })
                    }
                  >
                    {selected ? "当前" : "选择"}
                  </Button>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>托管版本</CardTitle>
          <CardDescription>下载官方 rclone 版本并在本地激活。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <SelectField
              label="下载版本"
              className="w-48"
              value={
                releases.some((r) => r.version === downloadVersion)
                  ? downloadVersion
                  : ""
              }
              placeholder={releases[0]?.version ?? "无可用版本"}
              options={releases.map((r) => ({
                value: r.version,
                label: r.version,
              }))}
              onChange={setDownloadVersion}
              disabled={releases.length === 0}
            />
            <Button
              size="sm"
              disabled={busy || releases.length === 0}
              onClick={() => void startDownload()}
            >
              <DownloadIcon /> 下载
            </Button>
          </div>
          {downloads.map((download) => (
            <div
              key={download.id}
              className="flex flex-wrap items-center gap-2 rounded-xl bg-background px-3 py-2.5 text-sm ring-1 ring-foreground/10"
            >
              <Badge variant="outline">{download.version}</Badge>
              <StatusChip status={download.status} />
              <span className="text-xs text-muted-foreground">
                {formatBytes(download.bytes)}
                {download.total_bytes
                  ? ` / ${formatBytes(download.total_bytes)}`
                  : ""}
              </span>
              {download.error ? (
                <span className="text-xs text-destructive">
                  {download.error}
                </span>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  )
}

const MODE_LABEL: Record<string, string> = {
  spawned: "本机托管",
  attached: "外部 RC",
}

const LINK_LABEL: Record<string, string> = {
  static: "静态链接",
  dynamic: "动态链接",
}

function modeLabel(mode: string) {
  return MODE_LABEL[mode] ?? mode
}

function connectionFacts(status: RcloneStatus | null) {
  const system = [status?.os, status?.arch].filter(Boolean).join("/")
  const systemLine = [system, status?.os_version].filter(Boolean).join(" · ")
  return [
    { label: "可执行文件", value: status?.binary || "—" },
    { label: "RC 地址", value: status?.endpoint || "本机托管时自动分配" },
    { label: "配置文件", value: status?.config || "rclone 默认" },
    { label: "系统", value: systemLine || "连接后显示" },
    { label: "Go", value: status?.go_version || "连接后显示" },
    {
      label: "链接方式",
      value: status?.linking
        ? (LINK_LABEL[status.linking] ?? status.linking)
        : "连接后显示",
    },
  ]
}
