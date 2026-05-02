import { useMemo, useState } from "react"

// Pure SVG candle chart + volume + 7d forecast — no external lib.
type Candle = { o: number; h: number; l: number; c: number; v: number }

function generateSeries(seed = 1, n = 60): Candle[] {
  let price = 178
  let s = seed
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  const out: Candle[] = []
  for (let i = 0; i < n; i++) {
    const drift = (rand() - 0.48) * 3.5
    const o = price
    const c = Math.max(20, o + drift)
    const h = Math.max(o, c) + rand() * 1.6
    const l = Math.min(o, c) - rand() * 1.6
    const v = 0.5 + rand() * 1.2
    out.push({ o, h, l, c, v })
    price = c
  }
  return out
}

export function CandleChart() {
  const [period, setPeriod] = useState("1D")
  const candles = useMemo(() => generateSeries(7, 60), [])
  const forecast = useMemo(() => {
    const last = candles[candles.length - 1].c
    const out: number[] = []
    let p = last
    for (let i = 0; i < 7; i++) {
      p += (Math.sin(i) + 0.4) * 1.2
      out.push(p)
    }
    return out
  }, [candles])

  const W = 760
  const H = 320
  const VH = 70
  const padX = 12
  const total = candles.length + forecast.length
  const cw = (W - padX * 2) / total

  const allHi = Math.max(...candles.map((c) => c.h), ...forecast)
  const allLo = Math.min(...candles.map((c) => c.l), ...forecast)
  const range = allHi - allLo || 1
  const y = (v: number) => H - ((v - allLo) / range) * (H - 8) - 4

  const maxV = Math.max(...candles.map((c) => c.v))
  const vy = (v: number) => VH - (v / maxV) * (VH - 4) - 2

  const last = candles[candles.length - 1]
  const first = candles[0]
  const chgPct = ((last.c - first.c) / first.c) * 100
  const up = chgPct >= 0

  // Forecast path
  const fcStartX = padX + candles.length * cw + cw / 2
  const fcPath = forecast
    .map((v, i) => `${i === 0 ? "M" : "L"} ${fcStartX + i * cw} ${y(v)}`)
    .join(" ")
  const fcAreaTop = forecast
    .map((v, i) => `${i === 0 ? "M" : "L"} ${fcStartX + i * cw} ${y(v)}`)
    .join(" ")
  const fcArea = `${fcAreaTop} L ${fcStartX + (forecast.length - 1) * cw} ${H} L ${fcStartX} ${H} Z`

  return (
    <div className="bg-[#161d27] rounded-2xl border border-[#232c3a] p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight">AAPL · Apple Inc.</h3>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Demo
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">1D · 5m intervals · 15min delayed</div>
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
        {/* OHLC overlay */}
        <div className="absolute top-2 left-2 z-10 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-[#232c3a] text-[11px] tabular-nums flex gap-3">
          <span><span className="text-slate-500">O</span> {last.o.toFixed(2)}</span>
          <span><span className="text-slate-500">H</span> {last.h.toFixed(2)}</span>
          <span><span className="text-slate-500">L</span> {last.l.toFixed(2)}</span>
          <span><span className="text-slate-500">C</span> {last.c.toFixed(2)}</span>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[320px]">
          {/* gridlines */}
          {[0.2, 0.4, 0.6, 0.8].map((p) => (
            <line key={p} x1={0} x2={W} y1={H * p} y2={H * p} stroke="border-default" strokeDasharray="2 4" />
          ))}

          {/* forecast area + line */}
          <defs>
            <linearGradient id="fcFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#f5b454" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#f5b454" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fcArea} fill="url(#fcFill)" />
          <path d={fcPath} fill="none" stroke="#f5b454" strokeWidth="1.6" strokeDasharray="4 4" />
          {/* forecast separator */}
          <line x1={fcStartX - cw / 2} x2={fcStartX - cw / 2} y1={0} y2={H} stroke="#f5b454" strokeOpacity="0.3" strokeDasharray="2 3" />

          {/* candles */}
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

        {/* Volume histogram */}
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
          {["1D", "5D", "1M", "3M", "1Y", "All"].map((t) => (
            <button
              key={t}
              onClick={() => setPeriod(t)}
              className={[
                "px-2.5 py-1 text-[11px] rounded-md transition-colors cursor-pointer",
                period === t ? "bg-amber/15 text-amber-accent" : "text-slate-500 hover:text-white hover:bg-white/5",
              ].join(" ")}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-[2px] bg-[#f5b454]" style={{ borderTop: "1px dashed #f5b454" }} />
            7d Forecast
          </span>
        </div>
      </div>
    </div>
  )
}
