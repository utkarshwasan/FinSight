import { useState, useEffect } from "react"
import { Plus } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { useWsStore } from "@/store/wsStore"
import { useWatchlist, useAddWatchlistItem } from "@/lib/queries/watchlist"

import { StatCard } from "@/components/dashboard/StatCard"
import { CandleChart } from "@/components/charts/CandleChart"
import { AICopilot } from "@/components/query/AICopilot"
import { DAGVisualizer } from "@/components/dag/DAGVisualizer"
import { HoldingsCard } from "@/components/positions/HoldingsCard"
import { Watchlist } from "@/components/watchlist/WatchlistCard"
import { MarketHours } from "@/components/dashboard/MarketHours"
import { AddPositionModal } from "@/components/positions/AddPositionModal"
import { DashboardShell } from "@/components/layout/DashboardShell"

export default function OverviewPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [runToken, setRunToken] = useState(0)
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)

  const { data: watchlist = [], isLoading } = useWatchlist()
  const addItem = useAddWatchlistItem()
  const latestPrices = useWsStore((s) => s.quoteTicks)

  const { data: positions } = useQuery({
    queryKey: ["positions"],
    queryFn: () => api.get("/positions").then((r) => r.data),
    retry: false,
  })

  // NEW: Initial price fetch to prevent $0.00 flicker
  const [initialPrices, setInitialPrices] = useState<Record<string, number>>({})
  useEffect(() => {
    if (watchlist.length > 0) {
      const fetchAll = async () => {
        const prices: Record<string, number> = {}
        await Promise.all(
          watchlist.map(async (w) => {
            try {
              const { data } = await api.get(`/quotes/${w.symbol}/latest`)
              prices[w.symbol] = data.price
            } catch {
              prices[w.symbol] = 0
            }
          })
        )
        setInitialPrices(prices)
      }
      fetchAll()
    }
  }, [watchlist])

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
          {isLoading ? (
            <div className="col-span-full text-center py-8">Loading watchlist...</div>
          ) : watchlist.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <p className="text-slate-400 mb-4">Your watchlist is empty</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addItem.mutate((e.target as any).symbol.value.toUpperCase());
                }}
                className="inline-flex gap-2"
              >
                <input name="symbol" placeholder="AAPL" className="px-3 py-1 rounded bg-slate-800 text-white" />
                <button type="submit" className="px-4 py-1 bg-amber-500 text-black rounded">Add</button>
              </form>
            </div>
          ) : (
            watchlist.map((w) => {
              const live = latestPrices[w.symbol];
              const price = live?.price ?? initialPrices[w.symbol] ?? 0;
              return <StatCard key={w.id} symbol={w.symbol} price={price} />;
            })
          )}
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
