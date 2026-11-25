import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import {
  LanguagesIcon,
  MoonIcon,
  PlayIcon,
  SearchIcon,
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
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { changeLanguage, type Locale } from "@/i18n"
import { NAV_ITEMS } from "@/app/nav"
import { isMacOs } from "@/lib/platform"
import { useTheme } from "@/app/providers/theme-provider"
import { useRcloneStore } from "@/stores/rclone-store"

/**
 * 快捷命令面板（⌘K / Ctrl+K）：导航项直接来自 lib/nav 注册表，
 * 与侧边栏保持同一份路径与文案；主题 / 语言 / rclone 启停就地读取全局状态。
 */
export function CommandPalette() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const running = useRcloneStore((state) => state.status?.running ?? false)
  const start = useRcloneStore((state) => state.start)
  const stop = useRcloneStore((state) => state.stop)
  const [open, setOpen] = useState(false)
  // 提示语按操作系统展示：mac 浏览器同样是 ⌘K；keydown 已同时接受两种修饰键。
  const shortcut = isMacOs ? "⌘ K" : "Ctrl K"

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

  const nextLocale: Locale = i18n.language.startsWith("zh") ? "en" : "zh"

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
              {NAV_ITEMS.map((item) => (
                <CommandItem
                  key={item.path}
                  onSelect={() => run(() => navigate(item.path))}
                >
                  <item.icon />
                  {t(item.labelKey)}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading={t("command.actions")}>
              <CommandItem
                onSelect={() => run(() => void (running ? stop() : start()))}
              >
                <PlayIcon />
                {running ? t("command.stopRclone") : t("command.startRclone")}
              </CommandItem>
              <CommandItem
                onSelect={() =>
                  run(() => setTheme(theme === "dark" ? "light" : "dark"))
                }
              >
                {theme === "dark" ? <SunIcon /> : <MoonIcon />}
                {theme === "dark"
                  ? t("command.lightTheme")
                  : t("command.darkTheme")}
              </CommandItem>
              <CommandItem
                onSelect={() => run(() => changeLanguage(nextLocale))}
              >
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
