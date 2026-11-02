import { useCallback, useEffect, useState } from "react"
import { RefreshCcwIcon, SaveIcon } from "lucide-react"
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
import type { SettingsDocument, SettingsPatchBody } from "@/lib/types"

type FormState = {
  rclone_bin: string
  rclone_rc_url: string
  rclone_config: string
  auto_start: boolean
}

const toForm = (document: SettingsDocument): FormState => ({
  rclone_bin: document.rclone_bin ?? "",
  rclone_rc_url: document.rclone_rc_url ?? "",
  rclone_config: document.rclone_config ?? "",
  auto_start: document.auto_start,
})

export function SettingsPage() {
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
          设置加载中…
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
      toast.success("设置已保存")
    } catch {
      // call() 已经弹出错误提示。
    } finally {
      setSaving(false)
    }
  }

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
    toast.success("rclone 路径已保存")
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle>rclone endpoint</CardTitle>
              <CardDescription>
                填写已有的 rclone RC 地址（如
                http://127.0.0.1:5572）时，Ourboros 会连接它而不是自己拉起
                rclone rcd。留空则启动托管 rclone rcd。默认不会自动拉起 rclone。
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              <RefreshCcwIcon />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>RC endpoint</Label>
            <Input
              className="max-w-md font-mono"
              value={form.rclone_rc_url}
              placeholder="http://127.0.0.1:5572，留空使用托管 rcd"
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
              label="启动 Ourboros 时自动连接 / 拉起 rclone"
              checked={form.auto_start}
              onCheckedChange={(auto_start) =>
                setForm((current) =>
                  current ? { ...current, auto_start } : current
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              默认关闭：只有手动点“启动 / 连接”时才会拉起 rclone。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={saving} onClick={() => void submit()}>
              <SaveIcon data-icon="inline-start" /> 保存设置
            </Button>
            <span className="text-xs text-muted-foreground">
              更新于 {formatTime(document.updated_at)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>rclone 可执行文件</CardTitle>
          <CardDescription>
            当前来源 {document.rclone_source}。留空时使用系统 PATH 中的 rclone。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-64 flex-1 flex-col gap-1.5">
            <Label>可执行文件路径</Label>
            <Input
              className="font-mono"
              value={form.rclone_bin}
              placeholder="rclone"
              onChange={(e) =>
                setForm((current) =>
                  current ? { ...current, rclone_bin: e.target.value } : current
                )
              }
            />
          </div>
          <Button size="sm" variant="outline" onClick={() => void saveBin()}>
            保存
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>命令行覆盖</CardTitle>
          <CardDescription>
            下面这些值来自当前进程的命令行参数时，无法通过设置页修改。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["rclone_bin", document.rclone_bin ?? "未设置"],
                ["rclone_config", document.rclone_config ?? "未设置"],
                ["rclone_rc_url", document.rclone_rc_url ?? "未设置"],
                ["workspace_path", document.workspace_path ?? "默认"],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="truncate font-mono text-xs" title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </>
  )
}
