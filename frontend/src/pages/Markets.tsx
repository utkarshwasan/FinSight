import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Search, ArrowUpDown, TrendingUp, TrendingDown } from "lucide-react"
import { DashboardShell } from "@/components/layout/DashboardShell"
import api from "@/lib/api"
import { useWsStore } from "@/store/wsStore"

type WatchlistApiItem = { id: number; symbol: string }

type Row = {
  symbol: string
  price: number
  change: number
  baseline: number
}

export default function MarketsPage() {
  const [q, setQ] = useState("")

  const { data: watchlist = [] } = useQuery<WatchlistApiItem[]>({
    queryKey: ["watchlist"],
    queryFn: () => api.get("/watchlist").then((r) => r.data),
    retry: false,
  })

  const quoteTicks = useWsStore((s) => s.quoteTicks)

  const [baseline, setBaseline] = useState<Record<string, number>>({})
  useEffect(() => {
    if (watchlist.length === 0) return
    let cancelled = false
    Promise.all(
      watchlist.map((w) =>
        api.get(`/quotes/${w.symbol}/latest`)
          .then((r) => [w.symbol, r.data.price as number] as const)
          .catch(() => [w.symbol, 0] as const)
      )
    ).then((entries) => {
      if (cancelled) return
      const next: Record<string, number> = {}
      for (const [s, p] of entries) next[s] = p
      setBaseline(next)
    })
    return () => { cancelled = true }
  }, [watchlist])

  const rows: Row[] = useMemo(
    () =>
      watchlist.map((w) => {
        const live = quoteTicks[w.symbol]?.price
        const base = baseline[w.symbol] ?? 0
        const price = live ?? base
        const change = base > 0 && live ? ((live - base) / base) * 100 : 0
        return { symbol: w.symbol, price, change, baseline: base }
      }),
    [watchlist, quoteTicks, baseline]
  )

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) => q === "" || r.symbol.toLowerCase().includes(q.toLowerCase())
      ),
    [rows, q]
  )

  const sorted = [...rows].filter((r) => r.price > 0)
  const gainers = [...sorted].sort((a, b) => b.change - a.change).slice(0, 3)
  const losers = [...sorted].sort((a, b) => a.change - b.change).slice(0, 3)

  return (
    <DashboardShell title="Markets" subtitle={`${rows.length} symbols · live ticks · 15-min delayed`}>
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
              {g.data.length === 0 ? (
                <div className="text-[11px] text-slate-500 py-3 px-3">Waiting for live ticks…</div>
              ) : (
                g.data.map((r) => {
                  const up = r.change >= 0
                  return (
                    <div key={r.symbol} className="flex items-center justify-between p-3 rounded-xl bg-[#1c2532] border border-[#232c3a]">
                      <div>
                        <div className="text-sm font-semibold">{r.symbol}</div>
                      </div>
                      <div className="text-right tabular-nums">
                        <div className="text-sm font-semibold">${r.price.toFixed(2)}</div>
                        <div className={`text-[11px] ${up ? "text-bull" : "text-bear"}`}>
                          {up ? "+" : ""}{r.change.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="bg-[#161d27] rounded-2xl border border-[#232c3a] p-5">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search symbol…"
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-[#1c2532] border border-[#232c3a] text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#f5b454] focus:ring-2 focus:ring-amber/30 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-[#232c3a]">
                {["Symbol", "Price", "Change", "Baseline"].map((h, i) => (
                  <th key={h} className={`py-3 px-3 font-medium ${i > 0 ? "text-right" : "text-left"}`}>
                    <span className="inline-flex items-center gap-1">
                      {h}
                      {i > 0 && <ArrowUpDown size={10} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const up = r.change >= 0
                return (
                  <tr key={r.symbol} className="border-b border-[#232c3a] hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-semibold">{r.symbol}</div>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-medium">
                      {r.price > 0 ? `$${r.price.toFixed(2)}` : "—"}
                    </td>
                    <td className={`py-3 px-3 text-right tabular-nums ${up ? "text-bull" : "text-bear"}`}>
                      {r.price > 0 ? `${up ? "+" : ""}${r.change.toFixed(2)}%` : "—"}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-400">
                      {r.baseline > 0 ? `$${r.baseline.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-500 text-sm">
                    {watchlist.length === 0
                      ? "Your watchlist is empty. Add symbols on the Watchlist page."
                      : "No symbols match your search."}
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
