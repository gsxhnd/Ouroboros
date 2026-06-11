import { AlertCircle, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"

import { AppShellPage } from "@/components/app-shell-page"
import { Button } from "@/components/ui/button"
import { getApiBaseUrl } from "@/services/http"

interface AppInitFailurePageProps {
  error: string | null
  retrying?: boolean
  onRetry: () => void
}

export function AppInitFailurePage({
  error,
  retrying = false,
  onRetry,
}: AppInitFailurePageProps) {
  const { t } = useTranslation()
  const apiUrl = getApiBaseUrl()

  return (
    <AppShellPage>
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="size-7 text-destructive" />
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">
          {t("bootstrap.failureTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("bootstrap.failureDescription")}
        </p>
      </div>

      {error ? (
        <p className="w-full rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-left text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <dl className="w-full space-y-1 rounded-lg border bg-muted/40 px-4 py-3 text-left text-sm">
        <dt className="text-muted-foreground">{t("system.apiUrl")}</dt>
        <dd className="break-all font-medium">
          {apiUrl || t("bootstrap.sameOrigin")}
        </dd>
      </dl>

      <Button disabled={retrying} onClick={onRetry}>
        <RefreshCw className={retrying ? "animate-spin" : undefined} />
        {retrying ? t("bootstrap.retrying") : t("bootstrap.retry")}
      </Button>
    </AppShellPage>
  )
}
