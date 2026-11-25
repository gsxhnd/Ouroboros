import i18n from "@/i18n"
import { getAuthToken } from "@/lib/auth"

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export type ApiResult = {
  ok: boolean
  status: number
  statusText: string
  ms: number
  contentType: string
  bodyText: string
  json: unknown | null
}

const METHODS_WITH_BODY = new Set<HttpMethod>(["POST", "PUT", "PATCH"])

export async function sendApiRequest(options: {
  method: HttpMethod
  path: string
  body: string
  signal?: AbortSignal
}): Promise<ApiResult> {
  const started = performance.now()
  const headers = new Headers()
  // server 模式绑定非回环地址时后端要求 Bearer token；回环模式没有 token，
  // 这个头不会被设置。
  const token = getAuthToken()
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }
  const init: RequestInit = {
    method: options.method,
    signal: options.signal,
    credentials: "same-origin",
    headers,
  }

  const trimmed = options.body.trim()
  if (trimmed && METHODS_WITH_BODY.has(options.method)) {
    headers.set("Content-Type", "application/json")
    init.body = trimmed
  }

  try {
    const response = await fetch(options.path, init)
    const bodyText = await response.text()
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      ms: Math.round(performance.now() - started),
      contentType: response.headers.get("content-type") ?? "",
      bodyText,
      json: parseJson(bodyText),
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : i18n.t("errors.networkFallback")
    return {
      ok: false,
      status: 0,
      statusText: message,
      ms: Math.round(performance.now() - started),
      contentType: "",
      bodyText: message,
      json: null,
    }
  }
}

function parseJson(text: string): unknown | null {
  if (!text) {
    return null
  }
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * EventSource 与浏览器直接发起的下载都无法设置 Authorization 头，改用
 * access_token 查询参数携带 token；未配置 token（回环模式）时原样返回。
 */
export function withAccessToken(path: string): string {
  const token = getAuthToken()
  if (!token) {
    return path
  }
  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}access_token=${encodeURIComponent(token)}`
}
