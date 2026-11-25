import i18n from "@/i18n"
import { withAccessToken } from "@/lib/http/transport"

const SSE_EVENT_NAMES = ["job", "mount", "download"] as const

/**
 * Subscribes to a server-sent event stream.
 *
 * EventSource reconnects on its own after transient failures, so a dropped
 * connection is not closed here. `onOpen` fires on every (re)connect, which lets
 * callers refetch a snapshot to cover events missed while disconnected.
 */
export function openEventSource(
  path: string,
  onEvent: (eventName: string, data: string) => void,
  onError: (message: string) => void = () => undefined,
  onOpen?: () => void
): () => void {
  const source = new EventSource(withAccessToken(path))

  for (const name of SSE_EVENT_NAMES) {
    source.addEventListener(name, (event) => {
      onEvent(name, (event as MessageEvent<string>).data)
    })
  }

  source.onopen = () => {
    onOpen?.()
  }

  source.onerror = () => {
    // CONNECTING means the browser is retrying; only CLOSED means it gave up.
    if (source.readyState === EventSource.CLOSED) {
      onError(i18n.t("errors.realtimeDisconnected"))
    }
  }

  return () => {
    source.close()
  }
}

/** 解析 SSE 事件体 `{ type, data }` 中的 data 字段；格式不符时返回 null。 */
export function parseEventPayload<T>(raw: string): T | null {
  try {
    const envelope = JSON.parse(raw) as { data?: T }
    return envelope.data ?? null
  } catch {
    return null
  }
}
