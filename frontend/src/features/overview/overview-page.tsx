import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { PlayIcon, SquareIcon } from "lucide-react"

import { StatusChip } from "@/components/common/status-chip"
import { PageContainer, PageHeader } from "@/components/common/page-header"
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

import { ActivityCard } from "@/features/overview/activity-card"
import { translateOr } from "@/i18n/lookup"
import { useRcloneStore } from "@/stores/rclone-store"
import type { RcloneStatus } from "@/lib/types"

/**
 * 概览页聚焦 rclone 连接状态：启停、版本与系统信息。
 * rclone 二进制的扫描、下载与切换在 设置 → rclone 二进制。
 */
export function OverviewPage() {
  const { t, i18n } = useTranslation()
  const status = useRcloneStore((state) => state.status)
  const rcloneBusy = useRcloneStore((state) => state.busy)
  const startRclone = useRcloneStore((state) => state.start)
  const stopRclone = useRcloneStore((state) => state.stop)

  return (
    <PageContainer>
      <PageHeader
        title={t("nav.overview")}
        description={t("nav.overviewHint")}
      />

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
                <PlayIcon data-icon="inline-start" />
                {t("overview.startOrConnect")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={rcloneBusy || status === null || !status.running}
                onClick={() => void stopRclone()}
              >
                <SquareIcon data-icon="inline-start" />
                {t("common.stop")}
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={status?.running ? "running" : "stopped"} />
            {status?.mode ? (
              <Badge variant="outline">
                {translateOr(i18n, `overview.mode.${status.mode}`, status.mode)}
              </Badge>
            ) : null}
            {status?.version ? (
              <Badge variant="secondary">{status.version}</Badge>
            ) : null}
            {status?.beta ? (
              <Badge variant="outline">{t("overview.beta")}</Badge>
            ) : null}
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            {connectionFacts(status, t, i18n).map((fact) => (
              <div
                key={fact.label}
                className="flex min-w-0 flex-col gap-1 rounded-lg bg-muted/50 px-3 py-2.5"
              >
                <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                <dd className="truncate font-mono text-sm" title={fact.value}>
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            {t("overview.binaryMovedHint")}{" "}
            <Link
              to="/settings/binary"
              className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
            >
              {t("nav.settings")}
            </Link>
          </p>
        </CardContent>
      </Card>

      <ActivityCard />
    </PageContainer>
  )
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
    {
      label: t("overview.factSystem"),
      value: systemLine || t("overview.afterConnect"),
    },
    {
      label: t("overview.factGo"),
      value: status?.go_version || t("overview.afterConnect"),
    },
    {
      label: t("overview.factLinking"),
      value: status?.linking
        ? translateOr(i18n, `overview.link.${status.linking}`, linkFallback)
        : t("overview.afterConnect"),
    },
  ]
}
