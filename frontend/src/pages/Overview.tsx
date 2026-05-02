import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { useWsStore } from "@/store/wsStore"

import { StatCard } from "@/components/dashboard/StatCard"
import { CandleChart } from "@/components/charts/CandleChart"
import { AICopilot } from "@/components/query/AICopilot"
import { DAGVisualizer } from "@/components/dag/DAGVisualizer"
import { HoldingsCard } from "@/components/positions/HoldingsCard"
import { Watchlist } from "@/components/watchlist/WatchlistCard"
import { MarketHours } from "@/components/dashboard/MarketHours"
import { AddPositionModal } from "@/components/positions/AddPositionModal"
import { DashboardShell } from "@/components/layout/DashboardShell"

const INITIAL_TICKERS = [
  { symbol: "AAPL", name: "Apple Inc.",    price: 178.42, change: -1.21, volume: "52.4M" },
  { symbol: "NVDA", name: "NVIDIA Corp.",  price: 612.88, change:  2.84, volume: "38.1M" },
  { symbol: "MSFT", name: "Microsoft",     price: 414.22, change:  0.62, volume: "21.7M" },
  { symbol: "TSLA", name: "Tesla",         price: 219.60, change: -3.18, volume: "118.2M" },
]

export default function OverviewPage() {
  const [tickers, setTickers] = useState(INITIAL_TICKERS)
  const [modalOpen, setModalOpen] = useState(false)
  const [runToken, setRunToken] = useState(0)
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)

  const connected = useWsStore((s) => s.connected)
  const quoteTicks = useWsStore((s) => s.quoteTicks) as Record<string, { price: number }>

  // Merge live WebSocket ticks into ticker list
  useEffect(() => {
    setTickers((arr) =>
      arr.map((t) => {
        const live = quoteTicks[t.symbol]
        if (live) return { ...t, price: live.price }
        return t
      })
    )
  }, [quoteTicks])

  // Simulated drift when no live data
  useEffect(() => {
    if (connected) return
    const interval = setInterval(() => {
      setTickers((arr) =>
        arr.map((t) => {
          const drift = (Math.random() - 0.5) * 0.006
          const price = +(t.price * (1 + drift)).toFixed(2)
          return { ...t, price, change: +(t.change + drift * 100).toFixed(2) }
        })
      )
    }, 2200)
    return () => clearInterval(interval)
  }, [connected])

  const { data: positions } = useQuery({
    queryKey: ["positions"],
    queryFn: () => api.get("/positions").then((r) => r.data),
    retry: false,
  })

  return (
    <>
      <DashboardShell 
        title="Dashboard" 
        subtitle="15-min delayed · Free tier · Educational use only"
        actions={
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#f5b454] hover:bg-[#f7c372] text-[#1a1207] text-sm font-medium transition-all active:scale-[0.98] shadow-lg shadow-[#f5b454]/30 cursor-pointer"
          >
            <Plus size={15} />
            Add Position
          </button>
        }
      >
        {/* Ticker Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {tickers.map((t) => (
            <StatCard key={t.symbol} {...t} />
          ))}
        </section>

        {/* Two-column row */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <CandleChart />
            <AICopilot
              onRun={(runId?: string) => {
                setRunToken((n) => n + 1)
                if (runId) setCurrentRunId(runId)
              }}
            />
          </div>

          <div className="space-y-6">
            <DAGVisualizer runToken={runToken} currentRunId={currentRunId} />
            <Watchlist />
            <MarketHours />
          </div>
        </section>

        {/* Holdings */}
        <section>
          <HoldingsCard positions={positions || []} onAdd={() => setModalOpen(true)} />
        </section>
      </DashboardShell>

      <AddPositionModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
