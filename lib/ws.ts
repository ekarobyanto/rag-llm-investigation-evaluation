import { WebSocketServer, WebSocket } from "ws"

export interface WSMessage {
  type: "CONNECTED" | "PONG" | "LOG_CREATED" | "STATUS_UPDATE" | "LOGS_CLEARED" | "RAGAS_UPDATE"
  [key: string]: any
}

declare global {
  // eslint-disable-next-line no-var
  var __wsServerInstance: WebSocketServer | undefined
  // eslint-disable-next-line no-var
  var __wsClients: Set<WebSocket> | undefined
}

export function getWebSocketServer(): WebSocketServer | null {
  if (typeof window !== "undefined") return null

  if (globalThis.__wsServerInstance) {
    return globalThis.__wsServerInstance
  }

  const port = parseInt(process.env.WS_PORT || "3001", 10)

  try {
    const clients = new Set<WebSocket>()
    globalThis.__wsClients = clients

    const wss = new WebSocketServer({ port }, () => {
      console.log(`[WebSocket] Live telemetry WS server listening on ws://localhost:${port}`)
    })

    wss.on("connection", (ws: WebSocket) => {
      clients.add(ws)

      // Send initial welcome message
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "CONNECTED", timestamp: Date.now() }))
      }

      ws.on("message", (message: string) => {
        try {
          const parsed = JSON.parse(message.toString())
          if (parsed.type === "PING") {
            ws.send(JSON.stringify({ type: "PONG", timestamp: Date.now() }))
          }
        } catch {
          // ignore non-json messages
        }
      })

      ws.on("close", () => {
        clients.delete(ws)
      })

      ws.on("error", (err) => {
        console.error("[WebSocket] Client error:", err)
        clients.delete(ws)
      })
    })

    wss.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        console.warn(`[WebSocket] Port ${port} is already in use. WS server will attempt connection reuse.`)
      } else {
        console.error("[WebSocket] Server error:", err)
      }
    })

    globalThis.__wsServerInstance = wss
    return wss
  } catch (err) {
    console.error("[WebSocket] Failed to initialize WebSocket server:", err)
    return null
  }
}

export function broadcastWSEvent(event: WSMessage): void {
  const clients = globalThis.__wsClients
  if (!clients || clients.size === 0) return

  const payload = JSON.stringify(event)
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload)
      } catch (err) {
        console.error("[WebSocket] Failed to send message to client:", err)
      }
    }
  }
}
