import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { useWsStore } from "@/store/wsStore"

interface WatchlistApiItem { id: number; symbol: string }

export function Watchlist() {
  const { data: items = [] } = useQuery<WatchlistApiItem[]>({
    queryKey: ["watchlist"],
    queryFn: () => api.get("/watchlist").then((r) => r.data),
    retry: false,
  })

  const quoteTicks = useWsStore((s) => s.quoteTicks)

  // Hydrate baseline prices once per symbol so we can compute change%
  const [baseline, setBaseline] = useState<Record<string, number>>({})
  useEffect(() => {
    const symbols = items.slice(0, 5).map((w) => w.symbol)
    if (symbols.length === 0) return
    let cancelled = false
    Promise.all(
      symbols.map((s) =>
        api.get(`/quotes/${s}/latest`)
          .then((r) => [s, r.data.price as number] as const)
          .catch(() => [s, 0] as const)
      )
    ).then((entries) => {
      if (cancelled) return
      const next: Record<string, number> = {}
      for (const [s, p] of entries) next[s] = p
      setBaseline(next)
    })
    return () => { cancelled = true }
  }, [items])

  const display = items.slice(0, 5).map((w) => {
    const live = quoteTicks[w.symbol]?.price
    const base = baseline[w.symbol] ?? 0
    const price = live ?? base
    const chg = base > 0 && live ? ((live - base) / base) * 100 : 0
    return { sym: w.symbol, price, chg }
  })

  return (
    <div className="bg-[#121821] rounded-2xl border border-[#232c3a] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold tracking-tight">Watchlist</h3>
        <span className="text-[11px] text-slate-500">{display.length} symbols</span>
      </div>
      <div className="space-y-1.5">
        {display.length === 0 ? (
          <div className="text-[11px] text-slate-500 py-2">Add symbols on the Watchlist page.</div>
        ) : (
          display.map((it) => {
            const up = it.chg >= 0
            return (
              <div
                key={it.sym}
                className="flex justify-between items-center px-3 py-2 rounded-lg bg-[#161d27] border border-[#232c3a] hover:border-amber/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${up ? "bg-bull" : "bg-bear"}`} />
                  <span className="text-[13px] font-medium">{it.sym}</span>
                </div>
                {it.price > 0 && (
                  <div className="text-right tabular-nums">
                    <div className="text-[13px] font-medium">${it.price.toFixed(2)}</div>
                    <div className={`text-[10px] ${up ? "text-bull" : "text-bear"}`}>
                      {up ? "+" : ""}
                      {it.chg.toFixed(2)}%
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
