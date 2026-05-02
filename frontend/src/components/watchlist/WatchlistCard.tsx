import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"

export function Watchlist() {
  const { data: items } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => api.get("/watchlist").then((r) => r.data),
    retry: false,
  })

  // Fallback static data while API loads
  const display = items?.length
    ? items.slice(0, 5).map((w: { id: number; symbol: string }) => ({
        sym: w.symbol,
        price: 0,
        chg: 0,
      }))
    : [
        { sym: "GOOGL", price: 142.31, chg: 0.42 },
        { sym: "AMZN",  price: 178.90, chg: -0.18 },
        { sym: "META",  price: 488.65, chg: 1.12 },
        { sym: "AMD",   price: 152.40, chg: -0.95 },
        { sym: "COIN",  price: 218.50, chg: 2.40 },
      ]

  return (
    <div className="bg-[#121821] rounded-2xl border border-[#232c3a] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold tracking-tight">Watchlist</h3>
        <span className="text-[11px] text-slate-500">{display.length} symbols</span>
      </div>
      <div className="space-y-1.5">
        {display.map((it: { sym: string; price: number; chg: number }) => {
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
        })}
      </div>
    </div>
  )
}
