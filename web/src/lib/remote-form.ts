import type { RemoteOption } from "@/lib/types"

export type FieldValue = string | boolean
export type FieldValues = Record<string, FieldValue>

export type BuildResult =
  | { ok: true; parameters: Record<string, unknown> }
  | { ok: false; error: string }

/** 密码和密钥不回显。主机、用户名虽然被 rclone 标成 sensitive，仍然明文填写。 */
export function isCredential(option: RemoteOption) {
  if (option.password) {
    return true
  }
  if (!option.sensitive) {
    return false
  }
  return /key|secret|token|pass/i.test(option.name)
}

/** rclone 用逗号分隔的 Provider 过滤；`!` 开头表示排除。 */
export function matchesProvider(filter: string | undefined, current: string) {
  const trimmed = filter?.trim() ?? ""
  if (!trimmed) {
    return true
  }
  const negate = trimmed.startsWith("!")
  const items = (negate ? trimmed.slice(1) : trimmed)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  const hit = items.includes(current)
  return negate ? !hit : hit
}

export function visibleOptions(options: RemoteOption[], provider: string) {
  return options.filter((option) => matchesProvider(option.provider, provider))
}

export function visibleExamples(option: RemoteOption, provider: string) {
  return (option.examples ?? []).filter((example) =>
    matchesProvider(example.provider, provider)
  )
}

export function helpSummary(help: string) {
  const flat = help.replace(/\s+/g, " ").trim()
  if (flat.length <= 140) {
    return flat
  }
  return `${flat.slice(0, 137)}…`
}

function providerOf(values: FieldValues) {
  return typeof values.provider === "string" ? values.provider : ""
}

export function valuesForProvider(
  options: RemoteOption[],
  provider: string,
  previous: FieldValues = {}
): FieldValues {
  const next: FieldValues = {}
  for (const option of visibleOptions(options, provider)) {
    if (option.name in previous) {
      next[option.name] = previous[option.name]
      continue
    }
    if (option.type === "bool") {
      next[option.name] = option.default === "true"
      continue
    }
    if (option.default) {
      next[option.name] = option.default
    }
  }
  if (provider) {
    next.provider = provider
  }
  return next
}

export function valuesFromParameters(
  options: RemoteOption[],
  parameters: Record<string, unknown>
): FieldValues {
  const provider = typeof parameters.provider === "string" ? parameters.provider : ""
  const values = valuesForProvider(options, provider)
  for (const option of options) {
    const raw = parameters[option.name]
    if (raw == null || raw === "") {
      continue
    }
    values[option.name] =
      option.type === "bool" ? raw === true || raw === "true" : String(raw)
  }
  return values
}

function loadedBool(
  option: RemoteOption,
  loaded: Record<string, unknown>,
  editing: boolean
) {
  if (!editing || !(option.name in loaded)) {
    return option.default === "true"
  }
  const raw = loaded[option.name]
  return raw === true || raw === "true"
}

function loadedText(
  option: RemoteOption,
  loaded: Record<string, unknown>,
  editing: boolean
) {
  if (!editing || !(option.name in loaded) || loaded[option.name] == null) {
    return option.default ?? ""
  }
  return String(loaded[option.name])
}

/** 只提交和当前基线不同的字段。密码留空表示保持原值。 */
export function parametersFromValues(
  options: RemoteOption[],
  values: FieldValues,
  editing: boolean,
  loaded: Record<string, unknown>
): BuildResult {
  const provider = providerOf(values)
  const parameters: Record<string, unknown> = {}
  for (const option of visibleOptions(options, provider)) {
    const value = values[option.name]
    if (option.type === "bool") {
      const bool = value === true
      if (bool !== loadedBool(option, loaded, editing)) {
        parameters[option.name] = bool
      }
      continue
    }
    const text = typeof value === "string" ? value.trim() : ""
    if (!text) {
      if (option.required && !(editing && isCredential(option))) {
        return { ok: false, error: `请填写 ${option.name}` }
      }
      continue
    }
    if (text === loadedText(option, loaded, editing).trim()) {
      continue
    }
    if (option.type === "int") {
      const parsed = Number(text)
      if (!Number.isInteger(parsed)) {
        return { ok: false, error: `${option.name} 需要整数` }
      }
      parameters[option.name] = parsed
      continue
    }
    parameters[option.name] = text
  }
  return { ok: true, parameters }
}
