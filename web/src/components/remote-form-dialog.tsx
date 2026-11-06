import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDownIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyHint, SelectField } from "@/components/shared"
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
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { call, errorMessage } from "@/lib/client"
import {
  helpSummary,
  isCredential,
  parametersFromValues,
  valuesForProvider,
  valuesFromParameters,
  visibleExamples,
  visibleOptions,
  type FieldValue,
  type FieldValues,
} from "@/lib/remote-form"
import { useRcloneStore } from "@/stores/rclone-store"
import type { RemoteDetail, RemoteOption, RemoteProvider } from "@/lib/types"
import { cn } from "cn"

const FEATURED = [
  "s3",
  "sftp",
  "webdav",
  "drive",
  "dropbox",
  "onedrive",
  "b2",
  "ftp",
  "smb",
  "alias",
  "local",
  "azureblob",
]

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

/** 远程 remote 的创建/编辑对话框，供远程页和画布共用。 */
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
  const { t, i18n } = useTranslation()
  const running = useRcloneStore((state) => state.status?.running ?? false)
  const [providers, setProviders] = useState<RemoteProvider[]>([])
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [query, setQuery] = useState("")
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [loadingForm, setLoadingForm] = useState(false)

  const providerLabel = (type: string | null | undefined) => {
    if (!type) {
      return t("remotes.untyped")
    }
    const key = `remotes.providers.${type}`
    return i18n.exists(key) ? i18n.t(key) : type
  }

  const loadProviders = async () => {
    const data = await call<{ providers: RemoteProvider[] }>("/api/remotes/providers")
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
            values: valuesFromParameters(provider?.options ?? [], detail.parameters ?? {}),
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
    // 仅在打开或切换编辑目标时初始化表单。
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const built = parametersFromValues(options, form.values, Boolean(form.editing), form.loaded)
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
          <p className="text-sm text-muted-foreground">{t("remotes.loadingTypes")}</p>
        ) : !running && providers.length === 0 ? (
          <EmptyHint>{t("remotes.startFirst")}</EmptyHint>
        ) : (
          <div className="flex max-h-[min(32rem,62svh)] flex-col gap-4 overflow-y-auto pe-1">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="remote-name">{t("common.name")}</FieldLabel>
                <Input
                  id="remote-name"
                  value={form.name}
                  disabled={Boolean(form.editing)}
                  placeholder="photos"
                  className="font-mono"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
                <FieldDescription>{t("remotes.nameHint")}</FieldDescription>
              </Field>
            </FieldGroup>

            {form.editing ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t("common.type")}</span>
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
                        className={cn("transition-transform", !advancedOpen && "-rotate-90")}
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
            onClick={() =>
              void submit().catch((error: unknown) =>
                toast.error(error instanceof Error ? error.message : errorMessage(null))
              )
            }
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TypePicker({
  providers,
  query,
  selected,
  onQuery,
  onSelect,
}: {
  providers: RemoteProvider[]
  query: string
  selected: string
  onQuery: (query: string) => void
  onSelect: (type: string) => void
}) {
  const { t, i18n } = useTranslation()
  const needle = query.trim().toLowerCase()
  const matches = useMemo(() => {
    const ranked = needle
      ? providers.filter((item) =>
          `${item.name} ${item.prefix} ${item.description}`.toLowerCase().includes(needle)
        )
      : providers.filter((item) => FEATURED.includes(item.name))
    return [...ranked].sort((a, b) => {
      const ai = FEATURED.indexOf(a.name)
      const bi = FEATURED.indexOf(b.name)
      if (ai === -1 && bi === -1) {
        return a.name.localeCompare(b.name)
      }
      if (ai === -1) {
        return 1
      }
      if (bi === -1) {
        return -1
      }
      return ai - bi
    })
  }, [needle, providers])

  return (
    <div className="flex flex-col gap-2">
      <Field>
        <FieldLabel htmlFor="remote-type-search">{t("common.type")}</FieldLabel>
        <Input
          id="remote-type-search"
          value={query}
          placeholder={t("remotes.typeSearchPlaceholder")}
          onChange={(event) => onQuery(event.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {matches.map((item) => {
          const active = item.name === selected
          const key = `remotes.providers.${item.name}`
          return (
            <button
              key={item.name}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(item.name)}
              className={cn(
                "rounded-xl px-2.5 py-2 text-left ring-1 ring-foreground/10 transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                active && "bg-primary/10 ring-primary"
              )}
            >
              <span className="block truncate text-sm font-medium">
                {i18n.exists(key) ? i18n.t(key) : item.name}
              </span>
              <span className="line-clamp-2 text-xs text-muted-foreground">{item.name}</span>
            </button>
          )
        })}
      </div>
      {matches.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("remotes.noTypeMatch")}</p>
      ) : null}
      {!needle ? (
        <p className="text-xs text-muted-foreground">
          {t("remotes.moreTypes", { count: Math.max(providers.length - matches.length, 0) })}
        </p>
      ) : null}
    </div>
  )
}

function OptionControl({
  option,
  provider,
  value,
  editing,
  onChange,
}: {
  option: RemoteOption
  provider: string
  value: FieldValue | undefined
  editing: boolean
  onChange: (value: FieldValue) => void
}) {
  const { t } = useTranslation()
  const id = `remote-opt-${option.name}`
  const help = helpSummary(option.help)
  const secret = isCredential(option)
  const examples = visibleExamples(option, provider)
  const text = typeof value === "string" ? value : ""

  if (option.type === "bool") {
    return (
      <Field orientation="horizontal">
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 size-4 accent-primary"
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
        />
        <FieldContent>
          <FieldLabel htmlFor={id}>{option.name}</FieldLabel>
          {help ? <FieldDescription title={option.help}>{help}</FieldDescription> : null}
        </FieldContent>
      </Field>
    )
  }

  if (option.type === "Tristate") {
    return (
      <SelectField
        label={option.name}
        value={text}
        placeholder={t("remotes.useDefault")}
        options={[
          { value: "true", label: t("common.yes") },
          { value: "false", label: t("common.no") },
        ]}
        onChange={onChange}
      />
    )
  }

  if (option.exclusive && examples.length > 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <SelectField
          label={optionLabel(option)}
          value={examples.some((example) => example.value === text) ? text : ""}
          placeholder={option.required ? t("remotes.selectRequired") : t("remotes.unset")}
          options={examples.map((example) => ({
            value: example.value,
            label:
              example.help && example.help.length <= 48
                ? `${example.value} · ${helpSummary(example.help)}`
                : example.value,
          }))}
          onChange={onChange}
        />
        {help ? (
          <p className="text-xs text-muted-foreground" title={option.help}>
            {help}
          </p>
        ) : null}
      </div>
    )
  }

  const listId = examples.length > 0 ? `${id}-list` : undefined
  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {option.name}
        {option.required ? <span className="text-destructive">*</span> : null}
      </FieldLabel>
      <Input
        id={id}
        list={listId}
        type={secret ? "password" : "text"}
        value={text}
        autoComplete="off"
        className={secret ? undefined : "font-mono"}
        placeholder={secret && editing ? t("remotes.keepOriginal") : (option.default ?? "")}
        onChange={(event) => onChange(event.target.value)}
      />
      {listId ? (
        <datalist id={listId}>
          {examples.map((example) => (
            <option key={example.value} value={example.value}>
              {example.help}
            </option>
          ))}
        </datalist>
      ) : null}
      {help ? <FieldDescription title={option.help}>{help}</FieldDescription> : null}
    </Field>
  )
}

function optionLabel(option: RemoteOption) {
  return option.required ? `${option.name} *` : option.name
}
