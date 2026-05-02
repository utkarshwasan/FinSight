import { TrendingUp, TrendingDown } from "lucide-react"
import { useEffect, useRef, useState } from "react"

type Props = {
  symbol: string
  name: string
  price: number
  change: number // pct
  volume: string
}

export function StatCard({ symbol, name, price, change, volume }: Props) {
  const up = change >= 0
  const [flash, setFlash] = useState<"up" | "down" | null>(null)
  const prev = useRef(price)

  useEffect(() => {
    if (price !== prev.current) {
      setFlash(price > prev.current ? "up" : "down")
      prev.current = price
      const t = setTimeout(() => setFlash(null), 600)
      return () => clearTimeout(t)
    }
  }, [price])

  return (
    <div
      className={[
        "group bg-[#161d27] rounded-2xl border border-[#232c3a] p-5 cursor-pointer",
        "transition-all duration-200 ease-out hover:border-amber/50 hover:shadow-[0_8px_24px_-8px_rgba(245,180,84,0.15)]",
        flash === "up" ? "flash-up" : flash === "down" ? "flash-down" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight">{symbol}</div>
          <div className="text-[11px] text-slate-500 truncate">{name}</div>
        </div>
        <div
          className={[
            "w-8 h-8 rounded-lg flex items-center justify-center",
            up ? "bg-emerald-500/10 text-bull" : "bg-red-500/10 text-bear",
          ].join(" ")}
        >
          {up ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
        </div>
      </div>

      <div className="text-2xl sm:text-[28px] font-display font-semibold mb-1 tabular-nums tracking-tight">
        ${price.toFixed(2)}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-500 tabular-nums">
        <span className={up ? "text-bull" : "text-bear"}>
          {up ? "+" : ""}
          {change.toFixed(2)}%
        </span>
        <span className="text-slate-700">·</span>
        <span>Vol {volume}</span>
      </div>
    </div>
  )
}
