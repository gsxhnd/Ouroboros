import type { ApiResult } from "@/lib/http/transport"

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
