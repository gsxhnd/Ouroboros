import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { useLibraryStore } from "@/stores/library"

export function LibraryPage() {
  const { t } = useTranslation()
  const {
    currentLibrary,
    loading,
    error,
    fetchInfo,
    close,
  } = useLibraryStore()

  useEffect(() => {
    void fetchInfo()
  }, [fetchInfo])

  if (loading && !currentLibrary) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("library.title")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void fetchInfo()}>
            {t("library.refresh")}
          </Button>
          <Button
            variant="destructive"
            disabled={!currentLibrary || loading}
            onClick={() => void close()}
          >
            {t("library.close")}
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {currentLibrary ? (
        <div className="rounded-lg border p-4">
          <p className="mb-4 text-sm font-medium">{t("library.current")}</p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t("library.path")}</dt>
              <dd className="font-mono text-xs">{currentLibrary.path}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("library.version")}</dt>
              <dd>{currentLibrary.version}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("library.createdAt")}</dt>
              <dd>{currentLibrary.created_at}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("library.none")}</p>
      )}
    </div>
  )
}
