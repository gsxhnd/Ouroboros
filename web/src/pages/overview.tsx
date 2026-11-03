import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
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
import { useRcloneStore } from "@/stores/rclone-store"
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
  const { t, i18n } = useTranslation()
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
      toast.error(t("overview.noVersions"))
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
          <CardTitle>{t("overview.connectionTitle")}</CardTitle>
          <CardDescription>
            {t("overview.connectionDescription")}
          </CardDescription>
          <CardAction>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={rcloneBusy || status === null || status.running}
                onClick={() => void startRclone()}
              >
                <PlayIcon data-icon="inline-start" /> {t("overview.startOrConnect")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={rcloneBusy || status === null || !status.running}
                onClick={() => void stopRclone()}
              >
                <SquareIcon data-icon="inline-start" /> {t("common.stop")}
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={status?.running ? "running" : "stopped"} />
            {status?.mode ? (
              <Badge variant="outline">
                {localLookup(i18n, `overview.mode.${status.mode}`, status.mode)}
              </Badge>
            ) : null}
            {status?.version ? (
              <Badge variant="secondary">{status.version}</Badge>
            ) : null}
            {status?.beta ? <Badge variant="outline">beta</Badge> : null}
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            {connectionFacts(status, t, i18n).map((fact) => (
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
          <CardTitle>{t("overview.binaryTitle")}</CardTitle>
          <CardDescription>{t("overview.binaryDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {candidates.length === 0 ? (
            <EmptyHint>{t("overview.noBinary")}</EmptyHint>
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
                    {selected ? t("common.current") : t("common.choose")}
                  </Button>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("overview.managedTitle")}</CardTitle>
          <CardDescription>{t("overview.managedDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <SelectField
              label={t("overview.downloadVersion")}
              className="w-48"
              value={
                releases.some((r) => r.version === downloadVersion)
                  ? downloadVersion
                  : ""
              }
              placeholder={releases[0]?.version ?? t("overview.noReleases")}
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
              <DownloadIcon /> {t("overview.download")}
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

/** 在语言包里查枚举文案；没有收录时回退到原值。 */
function localLookup(
  i18n: { exists: (key: string) => boolean; t: (key: string) => string },
  key: string,
  fallback: string
): string {
  return i18n.exists(key) ? i18n.t(key) : fallback
}

function connectionFacts(
  status: RcloneStatus | null,
  t: (key: string) => string,
  i18n: { exists: (key: string) => boolean; t: (key: string) => string }
) {
  const system = [status?.os, status?.arch].filter(Boolean).join("/")
  const systemLine = [system, status?.os_version].filter(Boolean).join(" · ")
  const linkFallback = status?.linking ?? ""
  return [
    { label: t("overview.factBinary"), value: status?.binary || "—" },
    {
      label: t("overview.factRcAddress"),
      value: status?.endpoint || t("overview.factRcAuto"),
    },
    {
      label: t("overview.factConfig"),
      value: status?.config || t("overview.factConfigDefault"),
    },
    { label: t("overview.factSystem"), value: systemLine || t("overview.afterConnect") },
    { label: t("overview.factGo"), value: status?.go_version || t("overview.afterConnect") },
    {
      label: t("overview.factLinking"),
      value: status?.linking
        ? localLookup(i18n, `overview.link.${status.linking}`, linkFallback)
        : t("overview.afterConnect"),
    },
  ]
}
