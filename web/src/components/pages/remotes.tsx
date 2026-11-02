import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDownIcon, PencilIcon, PlusIcon, RefreshCcwIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyHint, SelectField } from "@/components/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { useRcloneStore } from "@/lib/rclone-store"
import type {
  RemoteDetail,
  RemoteInfo,
  RemoteOption,
  RemoteProvider,
} from "@/lib/types"
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

const FEATURED_LABEL: Record<string, string> = {
  s3: "S3 对象存储",
  sftp: "SFTP",
  webdav: "WebDAV",
  drive: "Google 云端硬盘",
  dropbox: "Dropbox",
  onedrive: "OneDrive",
  b2: "Backblaze B2",
  ftp: "FTP",
  smb: "SMB / 共享",
  alias: "别名",
  local: "本地磁盘",
  azureblob: "Azure Blob",
}

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

export function RemotesPage() {
  const running = useRcloneStore((state) => state.status?.running ?? false)
  const [remotes, setRemotes] = useState<RemoteInfo[]>([])
  const [providers, setProviders] = useState<RemoteProvider[]>([])
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [query, setQuery] = useState("")
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [open, setOpen] = useState(false)
  const [loadingForm, setLoadingForm] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await call<{ remotes: RemoteInfo[] }>("/api/remotes")
      setRemotes(data.remotes)
    } catch {
      setRemotes([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const loadProviders = async () => {
    const data = await call<{ providers: RemoteProvider[] }>(
      "/api/remotes/providers"
    )
    setProviders(data.providers)
    return data.providers
  }

  const openCreate = async () => {
    setForm(EMPTY_FORM)
    setQuery("")
    setAdvancedOpen(false)
    setOpen(true)
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

  const openUpdate = async (name: string) => {
    setQuery("")
    setAdvancedOpen(false)
    setOpen(true)
    setLoadingForm(true)
    try {
      const [list, detail] = await Promise.all([
        loadProviders(),
        call<RemoteDetail>(`/api/remotes/${encodeURIComponent(name)}`),
      ])
      const provider = list.find((item) => item.name === detail.type)
      setForm({
        name,
        type: detail.type,
        values: valuesFromParameters(
          provider?.options ?? [],
          detail.parameters ?? {}
        ),
        loaded: detail.parameters ?? {},
        editing: name,
      })
    } catch {
      setOpen(false)
    } finally {
      setLoadingForm(false)
    }
  }

  const selected = providers.find((item) => item.name === form.type)
  const providerValue =
    typeof form.values.provider === "string" ? form.values.provider : ""
  const options = selected?.options ?? []
  const shown = visibleOptions(options, providerValue)
  const basic = shown.filter((option) => !option.advanced)
  const advanced = shown.filter((option) => option.advanced)

  const submit = async () => {
    if (!selected && !form.editing) {
      toast.error("先选择一种存储类型")
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
      toast.success(`已更新 ${form.editing}`)
    } else {
      const name = form.name.trim().replace(/:$/, "")
      if (!name || /[\s:/\\]/.test(name)) {
        toast.error("名称不能为空，也不能包含空格、冒号或斜杠")
        return
      }
      await call("/api/remotes", {
        method: "POST",
        body: { name, type: form.type, parameters: built.parameters },
      })
      toast.success(`已创建 ${name}`)
    }
    setOpen(false)
    await load()
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
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle>远程存储</CardTitle>
              <CardDescription>
                选类型、填地址和账号即可。凭据由 rclone 保管，不会回到浏览器。
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => void load()}>
                <RefreshCcwIcon data-icon="inline-start" /> 刷新
              </Button>
              <Button size="sm" onClick={() => void openCreate()}>
                <PlusIcon data-icon="inline-start" /> 新建
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {remotes.length === 0 ? (
            <EmptyHint>
              还没有远程存储。rclone 运行后点「新建」，勾选并填写即可。
            </EmptyHint>
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
                    {FEATURED_LABEL[remote.type ?? ""] ?? remote.type ?? "未标注类型"}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void openUpdate(remote.name)}
                >
                  <PencilIcon data-icon="inline-start" />
                  编辑
                </Button>
              </div>
            ))
          )}
          <p className="text-xs text-muted-foreground">共 {remotes.length} 个。</p>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {form.editing ? `编辑 ${form.editing}` : "新建远程存储"}
            </DialogTitle>
            <DialogDescription>
              常用项直接填写。高级设置默认收起，不改就沿用 rclone 的默认值。
            </DialogDescription>
          </DialogHeader>
          {loadingForm ? (
            <p className="text-sm text-muted-foreground">正在读取 rclone 的存储类型…</p>
          ) : !running && providers.length === 0 ? (
            <EmptyHint>先在概览里启动或连接 rclone，再创建远程存储。</EmptyHint>
          ) : (
            <div className="flex max-h-[min(32rem,62svh)] flex-col gap-4 overflow-y-auto pe-1">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="remote-name">名称</FieldLabel>
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
                  <FieldDescription>在文件和同步里用这个名字引用。</FieldDescription>
                </Field>
              </FieldGroup>

              {form.editing ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">类型</span>
                  <Badge variant="secondary">
                    {FEATURED_LABEL[form.type] ?? form.type}
                  </Badge>
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
                        高级设置
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
            <DialogClose render={<Button variant="outline" />}>取消</DialogClose>
            <Button
              disabled={loadingForm || (!form.editing && !form.type)}
              onClick={() =>
                void submit().catch((error: unknown) =>
                  toast.error(
                    error instanceof Error ? error.message : errorMessage(null)
                  )
                )
              }
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
  const needle = query.trim().toLowerCase()
  const matches = useMemo(() => {
    const ranked = needle
      ? providers.filter((item) =>
          `${item.name} ${item.prefix} ${item.description}`
            .toLowerCase()
            .includes(needle)
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
        <FieldLabel htmlFor="remote-type-search">类型</FieldLabel>
        <Input
          id="remote-type-search"
          value={query}
          placeholder="搜索，例如 s3、sftp、网盘"
          onChange={(event) => onQuery(event.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {matches.map((item) => {
          const active = item.name === selected
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
                {FEATURED_LABEL[item.name] ?? item.name}
              </span>
              <span className="line-clamp-2 text-xs text-muted-foreground">
                {item.name}
              </span>
            </button>
          )
        })}
      </div>
      {matches.length === 0 ? (
        <p className="text-xs text-muted-foreground">没有匹配的类型。</p>
      ) : null}
      {!needle ? (
        <p className="text-xs text-muted-foreground">
          先显示常用类型。搜索可以找到其余 {Math.max(providers.length - matches.length, 0)} 种。
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
        placeholder="使用默认"
        options={[
          { value: "true", label: "是" },
          { value: "false", label: "否" },
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
          placeholder={option.required ? "请选择" : "不设置"}
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
        {!option.exclusive && text && !examples.some((example) => example.value === text) ? (
          <Input
            value={text}
            className="font-mono"
            onChange={(event) => onChange(event.target.value)}
          />
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
        placeholder={
          secret && editing ? "留空则保持原值" : (option.default ?? "")
        }
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
