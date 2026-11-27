import { useState } from "react"
import { useTranslation } from "react-i18next"
import { RefreshCcwIcon, SaveIcon } from "lucide-react"
import { toast } from "sonner"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SwitchField } from "@/components/common/switch-field"
import { useSettingsDocument } from "@/features/settings/use-settings"
import { formatTime } from "@/lib/format"
import type {
  SettingsDocument,
  SettingsPatchBody,
  ShortcutAction,
} from "@/lib/types"

/** 与 internal/settings 中的 DefaultShortcuts 保持一致。 */
const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  show_main: "CmdOrCtrl+Shift+O",
  toggle_panel: "CmdOrCtrl+Shift+P",
  toggle_rclone: "CmdOrCtrl+Shift+R",
  quit: "CmdOrCtrl+Q",
}

const SHORTCUT_ACTIONS = Object.keys(DEFAULT_SHORTCUTS) as ShortcutAction[]

/** 文档未就绪时的占位卡片，设置页各分区共用。 */
export function SettingsLoading() {
  const { t } = useTranslation()
  return (
    <Card>
      <CardContent className="text-sm text-muted-foreground">
        {t("settings.loading")}
      </CardContent>
    </Card>
  )
}

/**
 * 分区内容以 document.updated_at 作为 key：
 * 保存成功后文档更新即整体重挂载，表单回到服务端的最新值。
 */
export function ConnectionSection() {
  const { document, load, patch } = useSettingsDocument()
  if (!document) {
    return <SettingsLoading />
  }
  return (
    <ConnectionForm
      key={document.updated_at}
      document={document}
      onReload={() => void load()}
      onPatch={patch}
    />
  )
}

function ConnectionForm({
  document,
  onReload,
  onPatch,
}: {
  document: SettingsDocument
  onReload: () => void
  onPatch: (body: SettingsPatchBody) => Promise<SettingsDocument>
}) {
  const { t } = useTranslation()
  const [rcUrl, setRcUrl] = useState(document.rclone_rc_url ?? "")
  const [autoStart, setAutoStart] = useState(document.auto_start)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await onPatch({
        auto_start: autoStart,
        rclone_rc_url: rcUrl.trim() || null,
      })
      toast.success(t("settings.saved"))
    } catch {
      // call() 已经弹出错误提示。
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.endpointTitle")}</CardTitle>
        <CardDescription>{t("settings.endpointDescription")}</CardDescription>
        <CardAction>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label={t("common.refresh")}
            title={t("common.refresh")}
            onClick={onReload}
          >
            <RefreshCcwIcon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-rc-url">{t("settings.rcUrl")}</Label>
          <Input
            id="settings-rc-url"
            className="max-w-md font-mono"
            value={rcUrl}
            placeholder={t("settings.rcUrlPlaceholder")}
            onChange={(event) => setRcUrl(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <SwitchField
            label={t("settings.autoStart")}
            checked={autoStart}
            onCheckedChange={setAutoStart}
          />
          <p className="text-xs text-muted-foreground">
            {t("settings.autoStartHint")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={saving} onClick={() => void save()}>
            <SaveIcon data-icon="inline-start" />
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
  )
}

export function ShortcutsSection() {
  const { document, patch } = useSettingsDocument()
  if (!document) {
    return <SettingsLoading />
  }
  return (
    <ShortcutsForm
      key={document.updated_at}
      document={document}
      onPatch={patch}
    />
  )
}

function ShortcutsForm({
  document,
  onPatch,
}: {
  document: SettingsDocument
  onPatch: (body: SettingsPatchBody) => Promise<SettingsDocument>
}) {
  const { t } = useTranslation()
  const [shortcuts, setShortcuts] = useState<Record<ShortcutAction, string>>(
    () => ({ ...DEFAULT_SHORTCUTS, ...document.shortcuts })
  )

  const resetShortcut = (action: ShortcutAction) =>
    setShortcuts((current) => ({
      ...current,
      [action]: DEFAULT_SHORTCUTS[action],
    }))

  const save = async () => {
    const body: Partial<Record<ShortcutAction, string>> = {}
    for (const action of SHORTCUT_ACTIONS) {
      body[action] = shortcuts[action].trim() || ""
    }
    try {
      await onPatch({ shortcuts: body })
      toast.success(t("settings.shortcutsSaved"))
    } catch {
      // call() 已经弹出错误提示。
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.shortcutsTitle")}</CardTitle>
        <CardDescription>{t("settings.shortcutsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {SHORTCUT_ACTIONS.map((action) => (
          <div key={action} className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-64 flex-1 flex-col gap-1.5">
              <Label htmlFor={`shortcut-${action}`}>
                {t(`settings.shortcutActions.${action}`)}
              </Label>
              <Input
                id={`shortcut-${action}`}
                className="font-mono"
                value={shortcuts[action]}
                placeholder={DEFAULT_SHORTCUTS[action]}
                onChange={(event) =>
                  setShortcuts((current) => ({
                    ...current,
                    [action]: event.target.value,
                  }))
                }
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={shortcuts[action] === DEFAULT_SHORTCUTS[action]}
              onClick={() => resetShortcut(action)}
            >
              {t("settings.shortcutReset")}
            </Button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void save()}>
            <SaveIcon data-icon="inline-start" />
            {t("settings.saveShortcuts")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("settings.shortcutsHint")}
        </p>
      </CardContent>
    </Card>
  )
}

export function RuntimeSection() {
  const { document } = useSettingsDocument()
  if (!document) {
    return <SettingsLoading />
  }
  return <RuntimeForm key={document.updated_at} document={document} />
}

function RuntimeForm({ document }: { document: SettingsDocument }) {
  const { t } = useTranslation()

  // rclone 可执行文件的选择与下载在「rclone 二进制」分区，这里只读展示。
  const cliFacts = (
    [
      ["rclone_bin", document.rclone_bin ?? t("settings.unset")],
      ["rclone_config", document.rclone_config ?? t("settings.unset")],
      ["rclone_rc_url", document.rclone_rc_url ?? t("settings.unset")],
      ["workspace_path", document.workspace_path ?? t("settings.default")],
    ] as const
  ).map(([label, value]) => ({ label, value }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.cliTitle")}</CardTitle>
        <CardDescription>{t("settings.cliDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2">
          {cliFacts.map((fact) => (
            <div
              key={fact.label}
              className="flex min-w-0 flex-col gap-1 rounded-lg bg-muted/50 px-3 py-2"
            >
              <dt className="text-xs text-muted-foreground">{fact.label}</dt>
              <dd className="truncate font-mono text-sm" title={fact.value}>
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
