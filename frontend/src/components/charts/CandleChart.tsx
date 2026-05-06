import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"

type Tick = { ts: string; price: number }
type Candle = { o: number; h: number; l: number; c: number; v: number }
type ForecastPoint = { ts: string; yhat: number; yhat_lower: number; yhat_upper: number }
type ForecastResp = { forecast: ForecastPoint[]; mape: number }

// Group ticks into pseudo-candles by chunking (approx OHLCV buckets)
function ticksToCandles(ticks: Tick[], bucketSize = 6): Candle[] {
  if (ticks.length === 0) return []
  const out: Candle[] = []
  for (let i = 0; i < ticks.length; i += bucketSize) {
    const slice = ticks.slice(i, i + bucketSize)
    if (slice.length === 0) continue
    const prices = slice.map((t) => t.price)
    out.push({
      o: prices[0],
      c: prices[prices.length - 1],
      h: Math.max(...prices),
      l: Math.min(...prices),
      v: slice.length,
    })
  }
  return out
}

type Props = { symbol?: string }

export function CandleChart({ symbol = "AAPL" }: Props) {
  const [period, setPeriod] = useState("1mo")

  const { data: ticks } = useQuery<Tick[]>({
    queryKey: ["history", symbol, period],
    queryFn: () =>
      api.get(`/quotes/${symbol}/history`, { params: { period } }).then((r) => r.data),
    retry: false,
  })

  const { data: forecastData } = useQuery<ForecastResp>({
    queryKey: ["forecast", symbol],
    queryFn: () => api.get(`/forecast/${symbol}`).then((r) => r.data),
    retry: false,
  })

  const candles = useMemo(() => ticksToCandles(ticks ?? []), [ticks])
  const forecast = useMemo(
    () => (forecastData?.forecast ?? []).map((p) => p.yhat),
    [forecastData]
  )
  const mape = forecastData?.mape

  const W = 760
  const H = 320
  const VH = 70
  const padX = 12

  if (candles.length === 0) {
    return (
      <div className="bg-[#161d27] rounded-2xl border border-[#232c3a] p-5">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-base font-semibold tracking-tight">{symbol}</h3>
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Loading
          </span>
        </div>
        <div className="h-[320px] rounded-xl w-full bg-[#1c2532] animate-pulse" />
      </div>
    )
  }

  const total = candles.length + forecast.length
  const cw = (W - padX * 2) / Math.max(total, 1)

  const allHi = Math.max(...candles.map((c) => c.h), ...(forecast.length ? forecast : [0]))
  const allLo = Math.min(...candles.map((c) => c.l), ...(forecast.length ? forecast : [Infinity]))
  const range = allHi - allLo || 1
  const y = (v: number) => H - ((v - allLo) / range) * (H - 8) - 4

  const maxV = Math.max(...candles.map((c) => c.v), 1)
  const vy = (v: number) => VH - (v / maxV) * (VH - 4) - 2

  const last = candles[candles.length - 1]
  const first = candles[0]
  const chgPct = ((last.c - first.c) / first.c) * 100
  const up = chgPct >= 0

  const fcStartX = padX + candles.length * cw + cw / 2
  const fcPath = forecast
    .map((v, i) => `${i === 0 ? "M" : "L"} ${fcStartX + i * cw} ${y(v)}`)
    .join(" ")
  const fcArea =
    forecast.length > 0
      ? `${fcPath} L ${fcStartX + (forecast.length - 1) * cw} ${H} L ${fcStartX} ${H} Z`
      : ""

  return (
    <div className="bg-[#161d27] rounded-2xl border border-[#232c3a] p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight">{symbol}</h3>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Live
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {period} · 15min delayed{mape !== undefined ? ` · MAPE ${(mape * 100).toFixed(1)}%` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl sm:text-[28px] font-display font-semibold tabular-nums">${last.c.toFixed(2)}</div>
          <div className={`text-xs tabular-nums ${up ? "text-bull" : "text-bear"}`}>
            {up ? "+" : ""}
            {(last.c - first.c).toFixed(2)} ({up ? "+" : ""}
            {chgPct.toFixed(2)}%)
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="absolute top-2 left-2 z-10 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-[#232c3a] text-[11px] tabular-nums flex gap-3">
          <span><span className="text-slate-500">O</span> {last.o.toFixed(2)}</span>
          <span><span className="text-slate-500">H</span> {last.h.toFixed(2)}</span>
          <span><span className="text-slate-500">L</span> {last.l.toFixed(2)}</span>
          <span><span className="text-slate-500">C</span> {last.c.toFixed(2)}</span>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[320px]">
          {[0.2, 0.4, 0.6, 0.8].map((p) => (
            <line key={p} x1={0} x2={W} y1={H * p} y2={H * p} stroke="#232c3a" strokeDasharray="2 4" />
          ))}

          {forecast.length > 0 && (
            <>
              <defs>
                <linearGradient id="fcFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f5b454" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#f5b454" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={fcArea} fill="url(#fcFill)" />
              <path d={fcPath} fill="none" stroke="#f5b454" strokeWidth="1.6" strokeDasharray="4 4" />
              <line
                x1={fcStartX - cw / 2}
                x2={fcStartX - cw / 2}
                y1={0}
                y2={H}
                stroke="#f5b454"
                strokeOpacity="0.3"
                strokeDasharray="2 3"
              />
            </>
          )}

          {candles.map((c, i) => {
            const cx = padX + i * cw + cw / 2
            const isUp = c.c >= c.o
            const color = isUp ? "#10b981" : "#ef4444"
            const top = y(Math.max(c.o, c.c))
            const bot = y(Math.min(c.o, c.c))
            return (
              <g key={i}>
                <line x1={cx} x2={cx} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth="1" />
                <rect
                  x={cx - cw * 0.32}
                  y={top}
                  width={cw * 0.64}
                  height={Math.max(1, bot - top)}
                  fill={color}
                />
              </g>
            )
          })}
        </svg>

        <svg viewBox={`0 0 ${W} ${VH}`} className="w-full h-[64px] mt-2">
          {candles.map((c, i) => {
            const cx = padX + i * cw + cw / 2
            const isUp = c.c >= c.o
            return (
              <rect
                key={i}
                x={cx - cw * 0.32}
                y={vy(c.v)}
                width={cw * 0.64}
                height={VH - vy(c.v) - 2}
                fill={isUp ? "#10b981" : "#ef4444"}
                opacity="0.45"
              />
            )
          })}
        </svg>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex gap-1">
          {[
            { label: "1D", v: "1d" },
            { label: "1W", v: "1wk" },
            { label: "1M", v: "1mo" },
            { label: "3M", v: "3mo" },
            { label: "1Y", v: "1y" },
          ].map((t) => (
            <button
              key={t.v}
              onClick={() => setPeriod(t.v)}
              className={[
                "px-2.5 py-1 text-[11px] rounded-md transition-colors cursor-pointer",
                period === t.v ? "bg-amber/15 text-amber-accent" : "text-slate-500 hover:text-white hover:bg-white/5",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-[2px] bg-[#f5b454]" />
            7d Holt-Winters forecast
          </span>
        </div>
      </div>
    </div>
  )
}
