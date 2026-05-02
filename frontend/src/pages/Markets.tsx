import { useEffect, useMemo, useState } from "react"
import { Search, ArrowUpDown, TrendingUp, TrendingDown } from "lucide-react"
import { DashboardShell } from "@/components/layout/DashboardShell"

type Row = {
  symbol: string
  name: string
  sector: string
  price: number
  change: number
  volume: string
  cap: string
}

const INITIAL: Row[] = [
  { symbol: "AAPL", name: "Apple Inc.", sector: "Tech", price: 178.42, change: -1.21, volume: "52.4M", cap: "2.78T" },
  { symbol: "NVDA", name: "NVIDIA Corp.", sector: "Semis", price: 612.88, change: 2.84, volume: "38.1M", cap: "1.51T" },
  { symbol: "MSFT", name: "Microsoft", sector: "Tech", price: 414.22, change: 0.62, volume: "21.7M", cap: "3.08T" },
  { symbol: "TSLA", name: "Tesla", sector: "Auto", price: 219.6, change: -3.18, volume: "118.2M", cap: "698B" },
  { symbol: "GOOGL", name: "Alphabet", sector: "Tech", price: 142.31, change: 0.42, volume: "29.0M", cap: "1.78T" },
  { symbol: "AMZN", name: "Amazon", sector: "Retail", price: 178.9, change: -0.18, volume: "44.6M", cap: "1.86T" },
  { symbol: "META", name: "Meta Platforms", sector: "Tech", price: 488.65, change: 1.12, volume: "18.4M", cap: "1.24T" },
  { symbol: "AMD", name: "Advanced Micro", sector: "Semis", price: 152.4, change: -0.95, volume: "55.2M", cap: "246B" },
  { symbol: "COIN", name: "Coinbase", sector: "Fin", price: 218.5, change: 2.4, volume: "12.8M", cap: "55B" },
  { symbol: "JPM", name: "JPMorgan Chase", sector: "Fin", price: 198.45, change: 0.31, volume: "9.1M", cap: "566B" },
  { symbol: "XOM", name: "Exxon Mobil", sector: "Energy", price: 116.12, change: -0.76, volume: "14.3M", cap: "468B" },
  { symbol: "NFLX", name: "Netflix", sector: "Media", price: 612.05, change: 1.85, volume: "5.9M", cap: "264B" },
]

const SECTORS = ["All", "Tech", "Semis", "Fin", "Auto", "Retail", "Energy", "Media"]

export default function MarketsPage() {
  const [rows, setRows] = useState(INITIAL)
  const [q, setQ] = useState("")
  const [sector, setSector] = useState("All")

  useEffect(() => {
    const t = setInterval(() => {
      setRows((arr) =>
        arr.map((r) => {
          const drift = (Math.random() - 0.5) * 0.006
          return { ...r, price: +(r.price * (1 + drift)).toFixed(2), change: +(r.change + drift * 100).toFixed(2) }
        })
      )
    }, 2400)
    return () => clearInterval(t)
  }, [])

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (sector === "All" || r.sector === sector) &&
          (q === "" || r.symbol.toLowerCase().includes(q.toLowerCase()) || r.name.toLowerCase().includes(q.toLowerCase()))
      ),
    [rows, q, sector]
  )

  const gainers = [...rows].sort((a, b) => b.change - a.change).slice(0, 3)
  const losers = [...rows].sort((a, b) => a.change - b.change).slice(0, 3)

  return (
    <DashboardShell title="Markets" subtitle={`${rows.length} symbols · live ticks · 15-min delayed`}>
      {/* Movers */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { title: "Top Gainers", data: gainers, icon: TrendingUp, color: "text-bull" },
          { title: "Top Losers", data: losers, icon: TrendingDown, color: "text-bear" },
        ].map((g) => (
          <div key={g.title} className="bg-[#161d27] rounded-2xl border border-[#232c3a] p-5">
            <div className="flex items-center gap-2 mb-4">
              <g.icon size={15} className={g.color} />
              <h3 className="text-sm font-semibold tracking-tight">{g.title}</h3>
            </div>
            <div className="space-y-2">
              {g.data.map((r) => {
                const up = r.change >= 0
                return (
                  <div key={r.symbol} className="flex items-center justify-between p-3 rounded-xl bg-[#1c2532] border border-[#232c3a]">
                    <div>
                      <div className="text-sm font-semibold">{r.symbol}</div>
                      <div className="text-[11px] text-slate-500 truncate">{r.name}</div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className="text-sm font-semibold">${r.price.toFixed(2)}</div>
                      <div className={`text-[11px] ${up ? "text-bull" : "text-bear"}`}>
                        {up ? "+" : ""}{r.change.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Filters + Table */}
      <section className="bg-[#161d27] rounded-2xl border border-[#232c3a] p-5">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search symbol or name…"
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-[#1c2532] border border-[#232c3a] text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#f5b454] focus:ring-2 focus:ring-amber/30 transition-all"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-thin">
            {SECTORS.map((s) => (
              <button
                key={s}
                onClick={() => setSector(s)}
                className={[
                  "px-3 h-10 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border",
                  s === sector
                    ? "bg-amber/15 border-amber/30 text-amber-accent"
                    : "bg-[#1c2532] border-[#232c3a] text-slate-400 hover:text-white",
                ].join(" ")}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-[#232c3a]">
                {["Symbol", "Sector", "Price", "Change", "Volume", "Mkt Cap"].map((h, i) => (
                  <th key={h} className={`py-3 px-3 font-medium ${i > 1 ? "text-right" : "text-left"}`}>
                    <span className="inline-flex items-center gap-1">
                      {h}
                      {i > 1 && <ArrowUpDown size={10} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const up = r.change >= 0
                return (
                  <tr key={r.symbol} className="border-b border-[#232c3a] hover:bg-white/[0.02] transition-colors cursor-pointer">
                    <td className="py-3 px-3">
                      <div className="font-semibold">{r.symbol}</div>
                      <div className="text-[11px] text-slate-500 truncate">{r.name}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#1c2532] border border-[#232c3a] text-slate-400">
                        {r.sector}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-medium">${r.price.toFixed(2)}</td>
                    <td className={`py-3 px-3 text-right tabular-nums ${up ? "text-bull" : "text-bear"}`}>
                      {up ? "+" : ""}{r.change.toFixed(2)}%
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-400">{r.volume}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-400">${r.cap}</td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 text-sm">
                    No symbols match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  )
}
