import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { useLibraryStore } from "@/stores/library"

export function HomePage() {
  const { t } = useTranslation()
  const { recentLibraries, open, create, loading, error } = useLibraryStore()

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("home.title")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("home.description")}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            disabled={loading}
            onClick={() => {
              const path = window.prompt("Library path")
              if (path) {
                void open(path)
              }
            }}
          >
            {t("home.openLibrary")}
          </Button>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => {
              const path = window.prompt("Library path")
              const name = window.prompt("Library name", "My Library")
              if (path && name) {
                void create(path, name)
              }
            }}
          >
            {t("home.createLibrary")}
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </section>

      {recentLibraries.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">{t("home.recentLibraries")}</h2>
          <ul className="space-y-2">
            {recentLibraries.map((library) => (
              <li
                key={library.path}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div>
                  <p className="font-medium">{library.name}</p>
                  <p className="text-xs text-muted-foreground">{library.path}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={loading}
                  onClick={() => void open(library.path)}
                >
                  {t("home.openLibrary")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
