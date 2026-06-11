import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"

import { AppShellPage } from "@/components/app-shell-page"

export function AppLoadingPage() {
  const { t } = useTranslation()

  return (
    <AppShellPage>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("app.name")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("app.tagline")}</p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {t("bootstrap.loading")}
        </p>
      </div>
    </AppShellPage>
  )
}
