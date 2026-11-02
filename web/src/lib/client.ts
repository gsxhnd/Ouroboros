import { toast } from "sonner"

import { sendApiRequest, type HttpMethod } from "@/lib/api"
import type { ApiErrorBody } from "@/lib/types"

const NETWORK_ERROR_MESSAGE = "无法连接到 Ourboros 服务，请确认它仍在运行。"

/** 执行一次 API 调用，成功时返回解析后的 JSON，失败时弹 toast 并抛出错误。 */
export async function call<T = unknown>(
  path: string,
  options: { method?: HttpMethod; body?: unknown } = {}
): Promise<T> {
  const method = options.method ?? "GET"
  const body = options.body === undefined ? "" : JSON.stringify(options.body)
  const response = await sendApiRequest({ method, path, body })
  if (response.status === 0) {
    toast.error(NETWORK_ERROR_MESSAGE)
    throw new Error(NETWORK_ERROR_MESSAGE)
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

/** 后端错误码到中文提示的映射；未收录的错误码沿用后端返回的 message。 */
const ERROR_CODE_MESSAGES: Record<string, string> = {
  already_running: "rclone 已经在运行。",
  forbidden_command: "不允许执行这个 rclone 操作。",
  invalid_command: "rclone 命令无效。",
  not_found: "找不到对应的对象，它可能已被删除。",
  io_error: "读写本地文件失败。",
}

export function errorMessage(json: unknown): string {
  const error = (json as ApiErrorBody | null)?.error
  if (!error) {
    return "请求失败"
  }
  if (error.code === "rclone_unavailable") {
    return error.message === "rclone is not running"
      ? "rclone 未运行，请先在“概览”页启动。"
      : `rclone 不可用：${error.message ?? ""}`
  }
  if (
    error.code === "conflict" &&
    error.message?.includes("overridden by CLI")
  ) {
    return "该设置由启动参数指定，无法在页面中修改。"
  }
  if (error.code && ERROR_CODE_MESSAGES[error.code]) {
    return ERROR_CODE_MESSAGES[error.code]
  }
  return error.message ?? "请求失败"
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
