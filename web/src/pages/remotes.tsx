import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { PencilIcon, PlusIcon, RefreshCcwIcon } from "lucide-react"

import { RemoteFormDialog } from "@/components/remote-form-dialog"
import { EmptyHint } from "@/components/shared"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { call } from "@/lib/client"
import type { RemoteInfo } from "@/lib/types"

export function RemotesPage() {
  const { t, i18n } = useTranslation()
  const [remotes, setRemotes] = useState<RemoteInfo[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  /** 已收录的存储类型走语言包，未收录的显示 rclone 原始类型名。 */
  const providerLabel = (type: string | null | undefined) => {
    if (!type) {
      return t("remotes.untyped")
    }
    const key = `remotes.providers.${type}`
    return i18n.exists(key) ? i18n.t(key) : type
  }

  const load = useCallback(async () => {
    try {
      const data = await call<{ remotes: RemoteInfo[] }>("/api/remotes")
      setRemotes(data.remotes)
    } catch {
      setRemotes([])
    }
  }, [])

  useEffect(() => {
    const run = async () => {
      await load()
    }
    void run()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setOpen(true)
  }

  const openUpdate = (name: string) => {
    setEditing(name)
    setOpen(true)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle>{t("remotes.title")}</CardTitle>
              <CardDescription>{t("remotes.description")}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => void load()}>
                <RefreshCcwIcon data-icon="inline-start" /> {t("common.refresh")}
              </Button>
              <Button size="sm" onClick={openCreate}>
                <PlusIcon data-icon="inline-start" /> {t("remotes.create")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {remotes.length === 0 ? (
            <EmptyHint>{t("remotes.empty")}</EmptyHint>
          ) : (
            remotes.map((remote) => (
              <div
                key={remote.name}
                className="flex items-center gap-3 rounded-xl bg-background px-3 py-2.5 ring-1 ring-foreground/10"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                  {(remote.type ?? remote.name).slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{remote.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {providerLabel(remote.type)}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => openUpdate(remote.name)}>
                  <PencilIcon data-icon="inline-start" />
                  {t("common.edit")}
                </Button>
              </div>
            ))
          )}
          <p className="text-xs text-muted-foreground">
            {t("remotes.count", { count: remotes.length })}
          </p>
        </CardContent>
      </Card>

      <RemoteFormDialog
        open={open}
        editing={editing}
        onOpenChange={setOpen}
        onSaved={() => void load()}
      />
    </>
  )
}
