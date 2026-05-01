import { useWsStore } from "@/store/wsStore"
import { useAuthStore } from "@/store/authStore"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { useRef, useEffect, useState } from "react"
import {
  TrendingUp, TrendingDown, Minus,
  Activity, Cpu, BarChart3, Zap,
  ArrowUpRight, Clock
} from "lucide-react"

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
      {/* Subtle top border glow on positive */}
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

// ── Activity row ──
function ActivityRow({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 0", borderBottom: "1px solid var(--border)",
    }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{label}</p>
        {sub && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</p>}
      </div>
      <span style={{
        fontSize: 13, fontWeight: 600,
        color: accent ? "#818CF8" : "var(--text-secondary)",
      }}>{value}</span>
    </div>
  )
}

// ── Mini sparkline ──
function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  const w = 80, h = 32
  if (values.length < 2) return null
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) =>
    `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * h}`
  ).join(" ")
  const color = positive ? "#10B981" : "#EF4444"
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
  const user = useAuthStore((s) => s.user)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Watchlist query
  const { data: watchlist } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => api.get("/watchlist").then((r) => r.data),
    retry: false,
  })

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>

      {/* ── Page header ── */}
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

        {/* Live badge */}
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

      {/* ── Stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {TICKERS.map((t) => {
          const live = quoteTicks[t.symbol]
          const price = live ? live.price : t.base
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

      {/* ── Two column layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>

        {/* Portfolio summary */}
        <div className="glass-card" style={{ padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <BarChart3 size={16} color="#818CF8" />
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Portfolio Summary</h2>
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Last 30 days</span>
          </div>

          {/* Big P&L number */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Unrealized P&L</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.04em", color: "#10B981", fontVariantNumeric: "tabular-nums" }}>
                +$2,847.30
              </span>
              <span style={{ fontSize: 14, color: "var(--green)", fontWeight: 600 }}>+8.4%</span>
            </div>
          </div>

          {/* Holdings bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Allocation</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>$36,850 total</span>
            </div>
            <div style={{ height: 6, background: "var(--bg-raised)", borderRadius: 99, overflow: "hidden", display: "flex" }}>
              {[
                { color: "#6366F1", width: "35%" },
                { color: "#10B981", width: "28%" },
                { color: "#D97706", width: "22%" },
                { color: "#818CF8", width: "15%" },
              ].map((s, i) => (
                <div key={i} style={{ width: s.width, background: s.color }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              {["NVDA", "AAPL", "TSLA", "MSFT"].map((sym, i) => (
                <div key={sym} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: ["#6366F1","#10B981","#D97706","#818CF8"][i] }} />
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{sym}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity rows */}
          <ActivityRow label="AAPL × 10 @ $175"  value="+$143.00" sub="Current: $189.30" accent />
          <ActivityRow label="NVDA × 5 @ $820"   value="+$276.00" sub="Current: $875.20" accent />
          <ActivityRow label="TSLA × 8 @ $230"   value="+$125.36" sub="Current: $245.67" accent />
          <div style={{ paddingBottom: 0 }}>
            <ActivityRow label="Total invested" value="$33,900" />
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* AI pipeline status */}
          <div className="glass-card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Cpu size={15} color="#818CF8" />
              <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>AI Pipeline</h2>
            </div>
            {["MarketData", "News", "Forecast", "Risk", "Alert"].map((node, i) => (
              <div key={node} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "7px 0",
                borderBottom: i < 4 ? "1px solid var(--border)" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: i === 0 ? "var(--green)" : i < 3 ? "#818CF8" : "var(--text-muted)",
                    boxShadow: i === 0 ? "0 0 6px var(--green)" : "none",
                  }} />
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{node}</span>
                </div>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {i === 0 ? "idle" : "standby"}
                </span>
              </div>
            ))}
          </div>

          {/* Watchlist summary */}
          <div className="glass-card" style={{ padding: "18px 20px", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Activity size={15} color="#818CF8" />
              <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Watchlist</h2>
            </div>
            {watchlist?.length ? (
              watchlist.slice(0, 5).map((item: any) => (
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
