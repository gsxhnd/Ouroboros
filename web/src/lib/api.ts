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
    const message = error instanceof Error ? error.message : "Network error"
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

export function openEventSource(
  path: string,
  onEvent: (eventName: string, data: string) => void,
  onError: (message: string) => void
): () => void {
  const source = new EventSource(path)
  const names = ["message", "job", "mount", "download"]

  for (const name of names) {
    source.addEventListener(name, (event) => {
      onEvent(name, (event as MessageEvent<string>).data)
    })
  }

  source.onerror = () => {
    onError("SSE connection failed")
    source.close()
  }

  return () => {
    source.close()
  }
}

export function formatResponseBody(result: ApiResult): string {
  if (result.json !== null) {
    return JSON.stringify(result.json, null, 2)
  }
  return result.bodyText
}

export function captureRevision(json: unknown): number | undefined {
  if (!json || typeof json !== "object") {
    return undefined
  }
  const revision = (json as { revision?: unknown }).revision
  return typeof revision === "number" ? revision : undefined
}

export function replaceJsonNumber(
  body: string,
  key: string,
  value: number
): string {
  const pattern = new RegExp(`("${key}"\\s*:\\s*)\\d+`)
  if (!pattern.test(body)) {
    return body
  }
  return body.replace(pattern, `$1${value}`)
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
