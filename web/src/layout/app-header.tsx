import { PanelRightIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AppHeaderProps {
  inspectorVisible: boolean
  onToggleInspector: () => void
}

export function AppHeader({
  inspectorVisible,
  onToggleInspector,
}: AppHeaderProps) {
  const { t } = useTranslation()

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b px-4">
      <div className="shrink-0">
        <p className="font-medium leading-none">{t("app.name")}</p>
        <p className="text-xs text-muted-foreground">{t("app.tagline")}</p>
      </div>

      <div className="flex min-w-0 flex-1 items-center">
        <div className="flex h-9 w-full max-w-md items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
          {t("layout.header.searchPlaceholder")}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-pressed={inspectorVisible}
          aria-label={t("layout.header.toggleInspector")}
          onClick={onToggleInspector}
        >
          <PanelRightIcon className={cn(!inspectorVisible && "opacity-50")} />
        </Button>
      </div>
    </header>
  )
}
