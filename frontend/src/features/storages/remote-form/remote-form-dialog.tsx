import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDownIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyHint } from "@/components/common/notes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { call } from "@/lib/http/client"
import {
  parametersFromValues,
  valuesForProvider,
  valuesFromParameters,
  visibleOptions,
  type FieldValue,
  type FieldValues,
} from "@/features/storages/remote-form/model"
import { OptionControl } from "@/features/storages/remote-form/option-control"
import { TypePicker } from "@/features/storages/remote-form/type-picker"
import { providerLabel } from "@/features/storages/remote-form/provider-label"
import { useRcloneStore } from "@/stores/rclone-store"
import type { RemoteDetail, RemoteProvider } from "@/lib/types"
import { cn } from "cn"

type FormState = {
  name: string
  type: string
  values: FieldValues
  loaded: Record<string, unknown>
  editing: string | null
}

const EMPTY_FORM: FormState = {
  name: "",
  type: "",
  values: {},
  loaded: {},
  editing: null,
}

/** 远程 remote 的创建/编辑对话框。 */
export function RemoteFormDialog({
  open,
  editing,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  /** 为空时创建新 remote，否则编辑指定 remote。 */
  editing: string | null
  onOpenChange: (open: boolean) => void
  /** 保存成功后回调，参数为 remote 名称。 */
  onSaved: (name: string) => void
}) {
  const { t } = useTranslation()
  const running = useRcloneStore((state) => state.status?.running ?? false)
  const [providers, setProviders] = useState<RemoteProvider[]>([])
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [query, setQuery] = useState("")
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [loadingForm, setLoadingForm] = useState(false)

  const loadProviders = async () => {
    const data = await call<{ providers: RemoteProvider[] }>(
      "/api/remotes/providers"
    )
    setProviders(data.providers)
    return data.providers
  }

  useEffect(() => {
    if (!open) {
      return
    }
    const run = async () => {
      setQuery("")
      setAdvancedOpen(false)
      if (editing) {
        setLoadingForm(true)
        try {
          const [list, detail] = await Promise.all([
            loadProviders(),
            call<RemoteDetail>(`/api/remotes/${encodeURIComponent(editing)}`),
          ])
          const provider = list.find((item) => item.name === detail.type)
          setForm({
            name: editing,
            type: detail.type,
            values: valuesFromParameters(
              provider?.options ?? [],
              detail.parameters ?? {}
            ),
            loaded: detail.parameters ?? {},
            editing,
          })
        } catch {
          onOpenChange(false)
        } finally {
          setLoadingForm(false)
        }
        return
      }
      setForm(EMPTY_FORM)
      if (!running) {
        return
      }
      setLoadingForm(true)
      try {
        await loadProviders()
      } catch {
        setProviders([])
      } finally {
        setLoadingForm(false)
      }
    }
    void run()
    // 仅在打开或切换编辑目标时初始化表单：running 轮询与 onOpenChange
    // 变化不应触发重新加载，此处有意豁免依赖检查。
    // oxlint-disable-next-line react-hooks/exhaustive-deps, react/exhaustive-effect-dependencies
  }, [open, editing])

  const selected = providers.find((item) => item.name === form.type)
  const providerValue =
    typeof form.values.provider === "string" ? form.values.provider : ""
  const options = selected?.options ?? []
  const shown = visibleOptions(options, providerValue)
  const basic = shown.filter((option) => !option.advanced)
  const advanced = shown.filter((option) => option.advanced)

  const submit = async () => {
    if (!selected && !form.editing) {
      toast.error(t("remotes.needType"))
      return
    }
    const built = parametersFromValues(
      options,
      form.values,
      Boolean(form.editing),
      form.loaded
    )
    if (!built.ok) {
      toast.error(built.error)
      return
    }
    if (form.editing) {
      await call(`/api/remotes/${encodeURIComponent(form.editing)}`, {
        method: "PATCH",
        body: { parameters: built.parameters },
      })
      toast.success(t("remotes.updated", { name: form.editing }))
      onSaved(form.editing)
    } else {
      const name = form.name.trim().replace(/:$/, "")
      if (!name || /[\s:/\\]/.test(name)) {
        toast.error(t("remotes.nameInvalid"))
        return
      }
      await call("/api/remotes", {
        method: "POST",
        body: { name, type: form.type, parameters: built.parameters },
      })
      toast.success(t("remotes.created", { name }))
      onSaved(name)
    }
    onOpenChange(false)
  }

  const chooseType = (type: string) => {
    const next = providers.find((item) => item.name === type)
    setForm((current) => ({
      ...current,
      type,
      values: valuesForProvider(next?.options ?? [], ""),
      loaded: {},
    }))
    setAdvancedOpen(false)
  }

  const setValue = (name: string, value: FieldValue) => {
    setForm((current) => {
      const values = { ...current.values, [name]: value }
      if (name === "provider" && typeof value === "string") {
        return {
          ...current,
          values: valuesForProvider(options, value, values),
        }
      }
      return { ...current, values }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {form.editing
              ? t("remotes.editTitle", { name: form.editing })
              : t("remotes.createTitle")}
          </DialogTitle>
          <DialogDescription>{t("remotes.formDescription")}</DialogDescription>
        </DialogHeader>
        {loadingForm ? (
          <p className="text-sm text-muted-foreground">
            {t("remotes.loadingTypes")}
          </p>
        ) : !running && providers.length === 0 ? (
          <EmptyHint>{t("remotes.startFirst")}</EmptyHint>
        ) : (
          <div className="flex max-h-[min(32rem,62svh)] flex-col gap-4 overflow-y-auto pe-1">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="remote-name">
                  {t("common.name")}
                </FieldLabel>
                <Input
                  id="remote-name"
                  value={form.name}
                  disabled={Boolean(form.editing)}
                  placeholder="photos"
                  className="font-mono"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
                <FieldDescription>{t("remotes.nameHint")}</FieldDescription>
              </Field>
            </FieldGroup>

            {form.editing ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {t("common.type")}
                </span>
                <Badge variant="secondary">{providerLabel(form.type)}</Badge>
              </div>
            ) : (
              <TypePicker
                providers={providers}
                query={query}
                selected={form.type}
                onQuery={setQuery}
                onSelect={chooseType}
              />
            )}

            {selected ? (
              <FieldGroup>
                {basic.map((option) => (
                  <OptionControl
                    key={option.name}
                    option={option}
                    provider={providerValue}
                    value={form.values[option.name]}
                    editing={Boolean(form.editing)}
                    onChange={(value) => setValue(option.name, value)}
                  />
                ))}
                {advanced.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      aria-expanded={advancedOpen}
                      onClick={() => setAdvancedOpen((current) => !current)}
                    >
                      <ChevronDownIcon
                        data-icon="inline-start"
                        className={cn(
                          "transition-transform",
                          !advancedOpen && "-rotate-90"
                        )}
                      />
                      {t("remotes.advanced")}
                      <Badge variant="outline">{advanced.length}</Badge>
                    </Button>
                    {advancedOpen
                      ? advanced.map((option) => (
                          <OptionControl
                            key={option.name}
                            option={option}
                            provider={providerValue}
                            value={form.values[option.name]}
                            editing={Boolean(form.editing)}
                            onChange={(value) => setValue(option.name, value)}
                          />
                        ))
                      : null}
                  </div>
                ) : null}
              </FieldGroup>
            ) : null}
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("common.cancel")}
          </DialogClose>
          <Button
            disabled={loadingForm || (!form.editing && !form.type)}
            onClick={() => void submit().catch(() => undefined)}
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
