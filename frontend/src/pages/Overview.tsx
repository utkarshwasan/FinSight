import { useWsStore } from "@/store/wsStore"
import { useAuthStore } from "@/store/authStore"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { useRef, useEffect, useState, useMemo } from "react"
import {
  TrendingUp, TrendingDown,
  Activity, Cpu, Sparkles, Plus,
  ArrowUpRight, Clock
} from "lucide-react"

import DAGVisualizer from "@/components/dag/DAGVisualizer"
import NLQueryBar from "@/components/query/NLQueryBar"
import AnswerPanel from "@/components/query/AnswerPanel"
import HoldingsCard from "@/components/positions/HoldingsCard"
import AddPositionForm from "@/components/positions/AddPositionForm"
import CandleChart from "@/components/charts/CandleChart"

function generateDummyData() {
  const data = []
  const now = new Date()
  for (let i = 30; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const base = 180 + Math.random() * 20
    data.push({
      time: d.toISOString().split('T')[0],
      open: base,
      high: base + Math.random() * 5,
      low: base - Math.random() * 5,
      close: base + Math.random() * 2 - 1
    })
  }
  return data
}

// ── Stat card ──
function StatCard({ symbol, price, change, changeVal, volume }: {
  symbol: string
  price: number
  change: number
  changeVal: number
  volume?: string
}) {
  const positive = change >= 0
  const prevPrice = useRef(price)
  const [flash, setFlash] = useState<"up" | "down" | null>(null)

  useEffect(() => {
    if (price !== prevPrice.current) {
      setFlash(price > prevPrice.current ? "up" : "down")
      prevPrice.current = price
      const t = setTimeout(() => setFlash(null), 500)
      return () => clearTimeout(t)
    }
  }, [price])

  return (
    <div
      className="glass-card glass-card-hover"
      style={{ padding: "20px 22px", cursor: "pointer", position: "relative", overflow: "hidden" }}
    >
      {positive && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.5), transparent)",
        }} />
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: positive ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
            border: `1px solid ${positive ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {positive ? <TrendingUp size={13} color="var(--green)" /> : <TrendingDown size={13} color="var(--red)" />}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.02em" }}>
            {symbol}
          </span>
        </div>
        <span
          className={`badge-${positive ? "up" : "down"}`}
          style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 5 }}
        >
          {positive ? "+" : ""}{change.toFixed(2)}%
        </span>
      </div>

      <div
        className={flash ? (flash === "up" ? "flash-up" : "flash-down") : ""}
        style={{
          fontSize: 26, fontWeight: 700, letterSpacing: "-0.04em",
          color: "var(--text-primary)", marginBottom: 6,
          fontVariantNumeric: "tabular-nums",
          padding: "2px 0", borderRadius: 4,
        }}
      >
        ${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {positive ? <ArrowUpRight size={11} color="var(--text-muted)" /> : <TrendingDown size={11} color="var(--text-muted)" />}
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {positive ? "+" : ""}{changeVal.toFixed(2)} today
          {volume && ` · Vol ${volume}`}
        </span>
      </div>
    </div>
  )
}

const TICKERS = [
  { symbol: "AAPL",  base: 189.30, change: 1.24, volume: "87M" },
  { symbol: "TSLA",  base: 245.67, change: -0.83, volume: "124M" },
  { symbol: "NVDA",  base: 875.20, change: 2.41, volume: "65M" },
  { symbol: "MSFT",  base: 421.50, change: 0.52, volume: "43M" },
]

export default function OverviewPage() {
  const quoteTicks = useWsStore((s) => s.quoteTicks)
  const connected  = useWsStore((s) => s.connected)
  const dagEvents  = useWsStore((s) => s.dagEvents)
  const user = useAuthStore((s) => s.user)
  const [time, setTime] = useState(new Date())
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)
  const [showAddPosition, setShowAddPosition] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const { data: watchlist } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => api.get("/watchlist").then((r) => r.data),
    retry: false,
  })

  const { data: positions } = useQuery({
    queryKey: ["positions"],
    queryFn: () => api.get("/positions").then((r) => r.data),
    retry: false,
  })

  const { data: forecastData } = useQuery({
    queryKey: ["forecast", "AAPL"],
    queryFn: () => api.get("/forecast/AAPL").then((r) => r.data),
    enabled: connected,
  })

  const candleData = useMemo(() => generateDummyData(), [])
  const hasLiveAapl = Boolean(quoteTicks.AAPL)

  const formattedForecast = useMemo(() => {
    if (!forecastData?.forecast) return []
    return forecastData.forecast.map((f: { ts: string, yhat: number }) => ({
      time: f.ts.split('T')[0],
      value: f.yhat
    }))
  }, [forecastData])

  const synthesisEvent = useMemo(() => {
    if (!currentRunId) return null
    return [...dagEvents].reverse().find(e => e.run_id === currentRunId && e.node === 'Synthesis')
  }, [dagEvents, currentRunId])

  const currentAnswer = synthesisEvent?.partial_output || null
  const isGenerating = currentRunId !== null && !currentAnswer && [...dagEvents].reverse().find(e => e.run_id === currentRunId && e.status === 'error') === undefined

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
      
      {showAddPosition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <AddPositionForm onClose={() => setShowAddPosition(false)} />
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#818CF8", marginBottom: 6 }}>
            Dashboard
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.04em", color: "var(--text-primary)", marginBottom: 4 }}>
            Market Overview
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {user?.full_name ? `Welcome back, ${user.full_name.split(" ")[0]}` : "Welcome back"} ·{" "}
            {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowAddPosition(true)}
            className="px-4 py-2 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-all border border-indigo-400/30 shadow-[0_8px_24px_rgba(99,102,241,0.25)] flex items-center gap-2"
          >
            <Plus size={16} />
            Add Position
          </button>
          
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px",
            background: connected ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${connected ? "rgba(16,185,129,0.25)" : "var(--border)"}`,
            borderRadius: 8,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: connected ? "var(--green)" : "var(--text-muted)",
              boxShadow: connected ? "0 0 8px var(--green)" : "none",
              animation: connected ? "pulse 2s infinite" : "none",
            }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: connected ? "var(--green)" : "var(--text-muted)" }}>
              {connected ? "LIVE" : "OFFLINE"}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {TICKERS.map((t) => {
          const live = quoteTicks[t.symbol as keyof typeof quoteTicks]
          const price = live ? (live as unknown as { price: number }).price : t.base
          const changeVal = (t.change / 100) * t.base
          return (
            <StatCard
              key={t.symbol}
              symbol={t.symbol}
              price={price}
              change={t.change}
              changeVal={changeVal}
              volume={t.volume}
            />
          )
        })}
      </div>

      <div className="grid grid-cols-[1fr_380px] gap-6">
        <div className="flex flex-col gap-6">
           <div className="glass-card p-4 h-[450px]">
              <CandleChart 
                symbol="AAPL" 
                data={candleData} 
                forecast={formattedForecast} 
              />
              {!hasLiveAapl && (
                <p className="mt-2 text-[11px] text-slate-500">
                  Showing demo candles until live ticks arrive.
                </p>
              )}
           </div>
           
           <div className="glass-card p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-indigo-400" />
                <h2 className="text-lg font-semibold text-white">AI Copilot</h2>
              </div>
              <p className="text-xs text-slate-400">
                Ask a question to run the DAG and generate a cited response.
              </p>
              <NLQueryBar onRunStarted={setCurrentRunId} />
              <AnswerPanel answer={currentAnswer} isGenerating={isGenerating} />
           </div>
        </div>

        <div className="flex flex-col gap-6">
           <div className="glass-card p-5 h-full">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Pipeline Execution</h3>
              {currentRunId ? (
                <DAGVisualizer events={dagEvents} currentRunId={currentRunId} />
              ) : (
                <div className="h-[420px] flex flex-col items-center justify-center text-slate-500 gap-4 border-2 border-dashed border-slate-800 rounded-xl">
                  <Cpu size={40} className="opacity-20" />
                  <p className="text-xs text-center max-w-[220px]">
                    Submit a query from AI Copilot to start DAG execution.
                  </p>
                </div>
              )}
           </div>
        </div>
      </div>

      {/* ── Two column layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>

        {/* Portfolio summary */}
        <HoldingsCard positions={positions || []} />

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Watchlist summary */}
          <div className="glass-card" style={{ padding: "18px 20px", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Activity size={15} color="#818CF8" />
              <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Watchlist</h2>
            </div>
            {watchlist?.length ? (
              watchlist.slice(0, 5).map((item: { id: number, symbol: string }) => (
                <div key={item.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "7px 0", borderBottom: "1px solid var(--border)",
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{item.symbol}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>
                </div>
              ))
            ) : (
              <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>
                No symbols yet — add from Watchlist
              </p>
            )}
          </div>

          {/* Market clock */}
          <div className="glass-card" style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Clock size={14} color="#818CF8" />
              <h2 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Market Hours</h2>
            </div>
            {[
              { market: "NYSE / NASDAQ", hours: "9:30 – 16:00 ET", status: "Open" },
              { market: "NSE / BSE",     hours: "9:15 – 15:30 IST", status: "Closed" },
              { market: "Crypto",        hours: "24 / 7", status: "Open" },
            ].map((m) => (
              <div key={m.market} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "5px 0",
              }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)" }}>{m.market}</p>
                  <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{m.hours}</p>
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                  padding: "2px 6px", borderRadius: 4,
                  color: m.status === "Open" ? "var(--green)" : "var(--text-muted)",
                  background: m.status === "Open" ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${m.status === "Open" ? "rgba(16,185,129,0.2)" : "var(--border)"}`,
                }}>
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
