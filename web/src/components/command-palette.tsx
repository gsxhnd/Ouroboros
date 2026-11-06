import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  CodeXmlIcon,
  GaugeIcon,
  LanguagesIcon,
  MoonIcon,
  PlayIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react"

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
type CommandPaletteProps = {
  isDark: boolean
  isRunning: boolean
  isMac: boolean
  onToggleTheme: () => void
  onToggleLanguage: () => void
  onToggleRclone: () => void
  onOpenOverview: () => void
  onOpenSettings: () => void
  onOpenApi: () => void
}

export function CommandPalette({
  isDark,
  isRunning,
  isMac,
  onToggleTheme,
  onToggleLanguage,
  onToggleRclone,
  onOpenOverview,
  onOpenSettings,
  onOpenApi,
}: CommandPaletteProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const shortcut = isMac ? "⌘ K" : "Ctrl K"

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const run = (action: () => void) => {
    setOpen(false)
    action()
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="hidden w-36 justify-between text-muted-foreground sm:inline-flex"
        aria-label={t("command.open")}
        onClick={() => setOpen(true)}
      >
        <span className="flex items-center gap-2">
          <SearchIcon />
          {t("command.search")}
        </span>
        <Kbd>{shortcut}</Kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        className="sm:hidden"
        aria-label={t("command.open")}
        onClick={() => setOpen(true)}
      >
        <SearchIcon />
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t("command.title")}
        description={t("command.description")}
        className="top-[20%] w-[min(92vw,36rem)] -translate-y-0"
      >
        <Command>
          <CommandInput placeholder={t("command.placeholder")} />
          <CommandList>
            <CommandEmpty>{t("command.empty")}</CommandEmpty>
            <CommandGroup heading={t("command.navigation")}>
              <CommandItem onSelect={() => run(onOpenOverview)}>
                <GaugeIcon />
                {t("command.overview")}
                <CommandShortcut>↵</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => run(onOpenSettings)}>
                <SettingsIcon />
                {t("command.settings")}
              </CommandItem>
              <CommandItem onSelect={() => run(onOpenApi)}>
                <CodeXmlIcon />
                {t("command.api")}
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading={t("command.actions")}>
              <CommandItem onSelect={() => run(onToggleRclone)}>
                <PlayIcon />
                {isRunning ? t("command.stopRclone") : t("command.startRclone")}
              </CommandItem>
              <CommandItem onSelect={() => run(onToggleTheme)}>
                {isDark ? <SunIcon /> : <MoonIcon />}
                {isDark ? t("command.lightTheme") : t("command.darkTheme")}
              </CommandItem>
              <CommandItem onSelect={() => run(onToggleLanguage)}>
                <LanguagesIcon />
                {t("command.switchLanguage")}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
