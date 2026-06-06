import { getApiBaseUrl } from "@/services/http"
import type { WsEvent } from "@/types"

type EventHandler = (event: WsEvent) => void
type StatusHandler = (connected: boolean) => void

const RECONNECT_DELAY_MS = 3_000

export class WsClient {
  private socket: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private disposed = false
  private readonly eventHandlers = new Set<EventHandler>()
  private readonly statusHandlers = new Set<StatusHandler>()

  connect() {
    if (this.disposed || this.socket) {
      return
    }

    const base = getApiBaseUrl() || window.location.origin
    const url = `${base.replace(/^http/, "ws")}/ws/events`
    this.socket = new WebSocket(url)

    this.socket.addEventListener("open", () => {
      this.notifyStatus(true)
    })

    this.socket.addEventListener("message", (message) => {
      try {
        const event = JSON.parse(String(message.data)) as WsEvent
        for (const handler of this.eventHandlers) {
          handler(event)
        }
      } catch {
        // ignore malformed payloads
      }
    })

    this.socket.addEventListener("close", () => {
      this.socket = null
      this.notifyStatus(false)
      this.scheduleReconnect()
    })

    this.socket.addEventListener("error", () => {
      this.socket?.close()
    })
  }

  disconnect() {
    this.disposed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.socket?.close()
    this.socket = null
    this.notifyStatus(false)
  }

  onEvent(handler: EventHandler) {
    this.eventHandlers.add(handler)
    return () => {
      this.eventHandlers.delete(handler)
    }
  }

  onStatus(handler: StatusHandler) {
    this.statusHandlers.add(handler)
    return () => {
      this.statusHandlers.delete(handler)
    }
  }

  private notifyStatus(connected: boolean) {
    for (const handler of this.statusHandlers) {
      handler(connected)
    }
  }

  private scheduleReconnect() {
    if (this.disposed || this.reconnectTimer) {
      return
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, RECONNECT_DELAY_MS)
  }
}

export const wsClient = new WsClient()
