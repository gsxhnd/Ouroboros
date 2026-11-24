import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  CableIcon,
  CommandIcon,
  RefreshCcwIcon,
  SaveIcon,
  ServerIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SwitchField } from "@/components/shared"
import { call, formatTime } from "@/lib/client"
import type {
  SettingsDocument,
  SettingsPatchBody,
  ShortcutAction,
} from "@/lib/types"

type FormState = {
  rclone_bin: string
  rclone_rc_url: string
  rclone_config: string
  auto_start: boolean
  shortcuts: Record<ShortcutAction, string>
}

/** 与 internal/settings 中的 DefaultShortcuts 保持一致。 */
const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  show_main: "CmdOrCtrl+Shift+O",
  toggle_panel: "CmdOrCtrl+Shift+P",
  toggle_rclone: "CmdOrCtrl+Shift+R",
  quit: "CmdOrCtrl+Q",
}

const SHORTCUT_ACTIONS = Object.keys(DEFAULT_SHORTCUTS) as ShortcutAction[]

const toForm = (document: SettingsDocument): FormState => ({
  rclone_bin: document.rclone_bin ?? "",
  rclone_rc_url: document.rclone_rc_url ?? "",
  rclone_config: document.rclone_config ?? "",
  auto_start: document.auto_start,
  shortcuts: { ...DEFAULT_SHORTCUTS, ...document.shortcuts },
})

export function SettingsPage() {
  const { t } = useTranslation()
  const [section, setSection] = useState<
    "connection" | "shortcuts" | "runtime"
  >("connection")
  const [document, setDocument] = useState<SettingsDocument | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await call<SettingsDocument>("/api/settings")
      setDocument(data)
      setForm(toForm(data))
    } catch {
      // call() 已经弹出错误提示；保持加载占位即可。
    }
  }, [])

  useEffect(() => {
    const run = async () => {
      await load()
    }
    void run()
  }, [load])

  if (!form || !document) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          {t("settings.loading")}
        </CardContent>
      </Card>
    )
  }

  const submit = async () => {
    setSaving(true)
    try {
      const patch: SettingsPatchBody = {
        auto_start: form.auto_start,
        rclone_rc_url: form.rclone_rc_url.trim() || null,
      }
      const next = await call<SettingsDocument>("/api/settings", {
        method: "PATCH",
        body: patch,
      })
      setDocument(next)
      setForm(toForm(next))
      toast.success(t("settings.saved"))
    } catch {
      // call() 已经弹出错误提示。
    } finally {
      setSaving(false)
    }
  }

  const saveShortcuts = async () => {
    const shortcuts: Partial<Record<ShortcutAction, string>> = {}
    for (const action of SHORTCUT_ACTIONS) {
      const value = form.shortcuts[action].trim()
      shortcuts[action] = value || ""
    }
    try {
      const next = await call<SettingsDocument>("/api/settings", {
        method: "PATCH",
        body: { shortcuts },
      })
      setDocument(next)
      setForm(toForm(next))
      toast.success(t("settings.shortcutsSaved"))
    } catch {
      // call() 已经弹出错误提示。
    }
  }

  const resetShortcut = (action: ShortcutAction) =>
    setForm((current) =>
      current
        ? {
            ...current,
            shortcuts: {
              ...current.shortcuts,
              [action]: DEFAULT_SHORTCUTS[action],
            },
          }
        : current
    )

  const saveBin = async () => {
    try {
      await call("/api/settings", {
        method: "PATCH",
        body: { rclone_bin: form.rclone_bin.trim() || null },
      })
    } catch {
      return
    }
    await load()
    toast.success(t("settings.binSaved"))
  }

  const sections = [
    {
      id: "connection" as const,
      label: t("settings.sections.connection"),
      icon: CableIcon,
    },
    {
      id: "shortcuts" as const,
      label: t("settings.sections.shortcuts"),
      icon: CommandIcon,
    },
    {
      id: "runtime" as const,
      label: t("settings.sections.runtime"),
      icon: ServerIcon,
    },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col sm:flex-row">
      <aside className="shrink-0 border-b bg-muted/20 p-2 sm:w-52 sm:border-r sm:border-b-0 sm:p-3">
        <p className="hidden px-2 pt-1 pb-2 text-xs font-medium tracking-wide text-muted-foreground sm:block">
          {t("settings.categories")}
        </p>
        <nav
          className="flex gap-1 overflow-x-auto sm:flex-col"
          aria-label={t("settings.categories")}
        >
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={section === id ? "page" : undefined}
              onClick={() => setSection(id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${section === id ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"}`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {section === "connection" ? (
            <Card>
              <CardHeader>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle>{t("settings.endpointTitle")}</CardTitle>
                    <CardDescription>
                      {t("settings.endpointDescription")}
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void load()}
                  >
                    <RefreshCcwIcon />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>{t("settings.rcUrl")}</Label>
                  <Input
                    className="max-w-md font-mono"
                    value={form.rclone_rc_url}
                    placeholder={t("settings.rcUrlPlaceholder")}
                    onChange={(e) =>
                      setForm((current) =>
                        current
                          ? { ...current, rclone_rc_url: e.target.value }
                          : current
                      )
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <SwitchField
                    label={t("settings.autoStart")}
                    checked={form.auto_start}
                    onCheckedChange={(auto_start) =>
                      setForm((current) =>
                        current ? { ...current, auto_start } : current
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("settings.autoStartHint")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={saving}
                    onClick={() => void submit()}
                  >
                    <SaveIcon data-icon="inline-start" />{" "}
                    {t("settings.saveSettings")}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {t("settings.updatedAt", {
                      time: formatTime(document.updated_at),
                    })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {section === "shortcuts" ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.shortcutsTitle")}</CardTitle>
                <CardDescription>
                  {t("settings.shortcutsDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {SHORTCUT_ACTIONS.map((action) => (
                  <div key={action} className="flex flex-wrap items-end gap-2">
                    <div className="flex min-w-64 flex-1 flex-col gap-1.5">
                      <Label>{t(`settings.shortcutActions.${action}`)}</Label>
                      <Input
                        className="font-mono"
                        value={form.shortcuts[action]}
                        placeholder={DEFAULT_SHORTCUTS[action]}
                        onChange={(e) =>
                          setForm((current) =>
                            current
                              ? {
                                  ...current,
                                  shortcuts: {
                                    ...current.shortcuts,
                                    [action]: e.target.value,
                                  },
                                }
                              : current
                          )
                        }
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        form.shortcuts[action] === DEFAULT_SHORTCUTS[action]
                      }
                      onClick={() => resetShortcut(action)}
                    >
                      {t("settings.shortcutReset")}
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => void saveShortcuts()}>
                    <SaveIcon data-icon="inline-start" />{" "}
                    {t("settings.saveShortcuts")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("settings.shortcutsHint")}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {section === "runtime" ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{t("settings.binaryTitle")}</CardTitle>
                  <CardDescription>
                    {t("settings.binaryDescription", {
                      source: document.rclone_source,
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end gap-2">
                  <div className="flex min-w-64 flex-1 flex-col gap-1.5">
                    <Label>{t("settings.binaryPath")}</Label>
                    <Input
                      className="font-mono"
                      value={form.rclone_bin}
                      placeholder="rclone"
                      onChange={(e) =>
                        setForm((current) =>
                          current
                            ? { ...current, rclone_bin: e.target.value }
                            : current
                        )
                      }
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void saveBin()}
                  >
                    {t("common.save")}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("settings.cliTitle")}</CardTitle>
                  <CardDescription>
                    {t("settings.cliDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        [
                          "rclone_bin",
                          document.rclone_bin ?? t("settings.unset"),
                        ],
                        [
                          "rclone_config",
                          document.rclone_config ?? t("settings.unset"),
                        ],
                        [
                          "rclone_rc_url",
                          document.rclone_rc_url ?? t("settings.unset"),
                        ],
                        [
                          "workspace_path",
                          document.workspace_path ?? t("settings.default"),
                        ],
                      ] as const
                    ).map(([label, value]) => (
                      <div
                        key={label}
                        className="flex min-w-0 flex-col gap-0.5"
                      >
                        <dt className="text-xs text-muted-foreground">
                          {label}
                        </dt>
                        <dd
                          className="truncate font-mono text-xs"
                          title={value}
                        >
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
