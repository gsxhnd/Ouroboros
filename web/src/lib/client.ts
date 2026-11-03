import { toast } from "sonner"

import { sendApiRequest, type HttpMethod } from "@/lib/api"
import i18n from "@/i18n"
import type { ApiErrorBody } from "@/lib/types"

/** 执行一次 API 调用，成功时返回解析后的 JSON，失败时弹 toast 并抛出错误。 */
export async function call<T = unknown>(
  path: string,
  options: { method?: HttpMethod; body?: unknown } = {}
): Promise<T> {
  const method = options.method ?? "GET"
  const body = options.body === undefined ? "" : JSON.stringify(options.body)
  const response = await sendApiRequest({ method, path, body })
  if (response.status === 0) {
    toast.error(i18n.t("errors.network"))
    throw new Error(i18n.t("errors.network"))
  }
  if (!response.ok) {
    const message = errorMessage(response.json)
    toast.error(message)
    throw new Error(message)
  }
  return response.json as T
}

/** 执行调用但不弹错误 toast，让调用方自己决定如何展示。 */
export async function callQuiet<T = unknown>(
  path: string,
  options: { method?: HttpMethod; body?: unknown } = {}
): Promise<T> {
  const method = options.method ?? "GET"
  const body = options.body === undefined ? "" : JSON.stringify(options.body)
  const response = await sendApiRequest({ method, path, body })
  if (!response.ok || response.status === 0) {
    throw new Error(
      response.status === 0 ? response.statusText : errorMessage(response.json)
    )
  }
  return response.json as T
}

/**
 * 后端错误码到本地化提示的映射（errors.codes.*）；
 * 未收录的错误码沿用后端返回的 message。
 */
function codeMessage(code: string): string {
  const key = `errors.codes.${code}`
  return i18n.exists(key) ? i18n.t(key) : ""
}

export function errorMessage(json: unknown): string {
  const error = (json as ApiErrorBody | null)?.error
  if (!error) {
    return i18n.t("errors.requestFailed")
  }
  if (error.code === "rclone_unavailable") {
    return error.message === "rclone is not running"
      ? i18n.t("errors.rcloneNotRunning")
      : i18n.t("errors.rcloneUnavailable", { message: error.message ?? "" })
  }
  if (
    error.code === "conflict" &&
    error.message?.includes("overridden by CLI")
  ) {
    return i18n.t("errors.cliOverride")
  }
  if (error.code) {
    const translated = codeMessage(error.code)
    if (translated) {
      return translated
    }
  }
  return error.message ?? i18n.t("errors.requestFailed")
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null || Number.isNaN(bytes)) {
    return "—"
  }
  if (bytes < 1024) {
    return `${bytes} B`
  }
  const units = ["KB", "MB", "GB", "TB", "PB"]
  let value = bytes
  let unit = "B"
  for (const next of units) {
    if (value < 1024) {
      break
    }
    value /= 1024
    unit = next
  }
  return `${value.toFixed(1)} ${unit}`
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) {
    return "—"
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toLocaleString()
}
