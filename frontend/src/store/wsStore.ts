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

interface AlertWithId extends AlertEvent {
  _id: string  // client-side unique id for dismiss
}

interface WsState {
  connected: boolean
  quoteTicks: Record<string, QuoteTick>
  dagEvents: DagEvent[]
  answersByRun: Record<string, { answer: string; sources: any[]; disclaimer: string }>
  alerts: AlertWithId[]
  setConnected: (v: boolean) => void
  handleEvent: (event: WsEvent) => void
  dismissAlert: (id: string) => void
}

export const useWsStore = create<WsState>((set) => ({
  connected: false,
  quoteTicks: {},
  dagEvents: [],
  answersByRun: {},
  alerts: [],

  setConnected: (connected) => set({ connected }),

  dismissAlert: (id) =>
    set((s) => ({ alerts: s.alerts.filter((a) => a._id !== id) })),

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
      set((s) => ({
        answersByRun: { ...s.answersByRun, [event.run_id]: {
          answer: event.answer,
          sources: event.sources,
          disclaimer: event.disclaimer,
        }},
      }))
    } else if (event.type === 'alert') {
      const _id = `${Date.now()}-${Math.random()}`
      set((state) => ({ alerts: [...state.alerts.slice(-4), { ...event, _id }] }))
    }
  },
}))
