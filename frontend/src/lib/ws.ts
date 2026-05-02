import ReconnectingWebSocket from 'reconnecting-websocket'
import { useAuthStore } from '@/store/authStore'
import { useWsStore } from '@/store/wsStore'

let ws: ReconnectingWebSocket | null = null

export function connectWS() {
  const token = useAuthStore.getState().token
  if (!token || ws) return

  const apiBase = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
  const wsBase = apiBase.replace(/^http/, "ws");
  const wsUrl = `${wsBase}/ws?token=${encodeURIComponent(token)}`;
  ws = new ReconnectingWebSocket(wsUrl)

  ws.addEventListener('open', () => {
    useWsStore.getState().setConnected(true)
  })

  ws.addEventListener('close', () => {
    useWsStore.getState().setConnected(false)
  })

  ws.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data as string)
      useWsStore.getState().handleEvent(data)
    } catch {
      // ignore malformed messages
    }
  })
}

export function disconnectWS() {
  ws?.close()
  ws = null
  useWsStore.getState().setConnected(false)
}
