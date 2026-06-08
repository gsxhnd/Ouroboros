import { useTranslation } from "react-i18next"

export function SecondaryPanel() {
  const { t } = useTranslation()

  return (
    <aside className="flex h-full flex-col border-l bg-muted/20">
      <div className="border-b px-4 py-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t("layout.secondary.title")}
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-center text-sm text-muted-foreground">
          {t("layout.secondary.placeholder")}
        </p>
      </div>
    </aside>
  )
}
