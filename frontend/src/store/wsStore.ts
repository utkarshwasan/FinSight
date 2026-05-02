import { create } from 'zustand'

interface QuoteTick {
  symbol: string
  price: number
  ts: string
}

interface DagEvent {
  type: 'dag_event'
  node: string
  status: 'running' | 'done' | 'error' | 'skipped'
  run_id: string
  started_at?: string
  ended_at?: string
  tokens: number
  latency_ms: number
  partial_output?: string
}

interface QueryCompleteEvent {
  type: 'query_complete'
  run_id: string
  answer: string
  sources: any[]
  disclaimer: string
  degraded: boolean
}

interface AlertEvent {
  type: 'alert'
  symbol: string
  message: string
  price: number
}

type WsEvent = QuoteTick & { type: 'quote_tick' } | DagEvent | QueryCompleteEvent | AlertEvent

interface WsState {
  connected: boolean
  quoteTicks: Record<string, QuoteTick>
  dagEvents: DagEvent[]
  queryComplete: QueryCompleteEvent | null
  alerts: AlertEvent[]
  setConnected: (v: boolean) => void
  handleEvent: (event: WsEvent) => void
}

export const useWsStore = create<WsState>((set) => ({
  connected: false,
  quoteTicks: {},
  dagEvents: [],
  queryComplete: null,
  alerts: [],

  setConnected: (connected) => set({ connected }),

  handleEvent: (event) => {
    if (event.type === 'quote_tick') {
      set((state) => ({
        quoteTicks: {
          ...state.quoteTicks,
          [event.symbol]: event,
        },
      }))
    } else if (event.type === 'dag_event') {
      set((state) => ({ dagEvents: [...state.dagEvents.slice(-50), event] }))
    } else if (event.type === 'query_complete') {
      set((state) => ({ queryComplete: event }))
    } else if (event.type === 'alert') {
      set((state) => ({ alerts: [...state.alerts.slice(-20), event] }))
    }
  },
}))
