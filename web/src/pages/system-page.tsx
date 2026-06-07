import { useEffect } from "react"
import { Link } from "react-router"
import { useTranslation } from "react-i18next"

import { Button, buttonVariants } from "@/components/ui/button"
import { getApiBaseUrl } from "@/services/http"
import { useSystemStore } from "@/stores/system"
import { cn } from "@/lib/utils"

function StatusBadge({ online }: { online: boolean }) {
  const { t } = useTranslation()

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
        online
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-destructive/10 text-destructive",
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          online ? "bg-emerald-500" : "bg-destructive",
        )}
      />
      {online ? t("system.statusOnline") : t("system.statusOffline")}
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm break-all">{value}</dd>
    </div>
  )
}

export function SystemPage() {
  const { t } = useTranslation()
  const {
    status,
    systemInfo,
    libraryDetail,
    loading,
    error,
    checkedAt,
    refresh,
  } = useSystemStore()

  useEffect(() => {
    void refresh()
  }, [refresh])

  const isOnline = status === "online"
  const apiBase = getApiBaseUrl() || window.location.origin

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t("system.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("system.description")}</p>
        </div>
        <Button variant="outline" disabled={loading} onClick={() => void refresh()}>
          {t("system.refresh")}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="rounded-lg border p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium">{t("system.service")}</h2>
          <StatusBadge online={isOnline} />
        </div>

        {loading && !systemInfo ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <InfoRow label={t("system.apiUrl")} value={apiBase} />
            {systemInfo ? (
              <>
                <InfoRow label={t("system.serviceName")} value={systemInfo.name} />
                <InfoRow label={t("system.version")} value={systemInfo.version} />
              </>
            ) : null}
            {checkedAt ? (
              <InfoRow
                label={t("system.lastChecked")}
                value={new Date(checkedAt).toLocaleString()}
              />
            ) : null}
          </dl>
        )}
      </section>

      <section className="rounded-lg border p-4 space-y-4">
        <h2 className="text-sm font-medium">{t("system.library")}</h2>

        {!isOnline ? (
          <p className="text-sm text-muted-foreground">{t("system.libraryUnavailable")}</p>
        ) : systemInfo?.library_open ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <InfoRow
              label={t("library.path")}
              value={
                libraryDetail?.path ??
                systemInfo.library_path ??
                t("system.unknown")
              }
            />
            {(libraryDetail?.name ?? systemInfo.library_name) ? (
              <InfoRow
                label={t("system.libraryName")}
                value={libraryDetail?.name ?? systemInfo.library_name ?? ""}
              />
            ) : null}
            {libraryDetail ? (
              <>
                <InfoRow label={t("library.version")} value={libraryDetail.version} />
                <InfoRow label={t("library.createdAt")} value={libraryDetail.created_at} />
              </>
            ) : null}
          </dl>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("library.none")}</p>
            <Link to="/" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              {t("system.openLibraryHint")}
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
