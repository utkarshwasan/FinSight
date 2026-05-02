import { Trash2, Plus } from "lucide-react"
import { useEffect, useRef, useState, useMemo } from "react"
import { useWsStore } from "@/store/wsStore"
import { useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"

interface Position {
  id: number
  symbol: string
  quantity: number
  average_price: number
}

function Row({ p, onDelete }: { p: Position; onDelete: () => void }) {
  const quoteTicks = useWsStore((s) => s.quoteTicks) as Record<string, { price: number }>
  const livePrice = quoteTicks[p.symbol]?.price ?? p.average_price
  const [flash, setFlash] = useState<"up" | "down" | null>(null)
  const prev = useRef(livePrice)

  useEffect(() => {
    if (livePrice !== prev.current) {
      setFlash(livePrice > prev.current ? "up" : "down")
      prev.current = livePrice
      const t = setTimeout(() => setFlash(null), 600)
      return () => clearTimeout(t)
    }
  }, [livePrice])

  const value = p.quantity * livePrice
  const cost = p.quantity * p.average_price
  const pl = value - cost
  const plPct = cost ? (pl / cost) * 100 : 0
  const up = pl >= 0

  return (
    <div className="group flex justify-between items-center p-3 rounded-xl bg-[#161d27] border border-[#232c3a] hover:border-amber/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber/15 to-amber/5 border border-amber/30 flex items-center justify-center text-[11px] font-bold text-amber-accent">
          {p.symbol.slice(0, 2)}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{p.symbol}</div>
          <div className="text-[11px] text-slate-500 truncate tabular-nums">
            {p.quantity} shares · avg ${p.average_price.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className={`text-right rounded-md px-2 py-1 ${flash === "up" ? "flash-up" : flash === "down" ? "flash-down" : ""}`}>
          <div className="text-sm font-semibold tabular-nums">${value.toFixed(2)}</div>
          <div className={`text-[11px] tabular-nums ${up ? "text-bull" : "text-bear"}`}>
            {up ? "+" : ""}
            {pl.toFixed(2)} ({up ? "+" : ""}
            {plPct.toFixed(2)}%)
          </div>
        </div>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-bear w-8 h-8 rounded-lg hover:bg-red-500/10 flex items-center justify-center cursor-pointer"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

export function HoldingsCard({ positions, onAdd }: { positions: Position[]; onAdd: () => void }) {
  const queryClient = useQueryClient()
  const quoteTicks = useWsStore((s) => s.quoteTicks) as Record<string, { price: number }>

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/positions/${id}`)
      queryClient.invalidateQueries({ queryKey: ["positions"] })
    } catch (err) {
      console.error("Delete failed", err)
    }
  }

  const { totalValue, pl, plPct, up } = useMemo(() => {
    const totalValue = positions.reduce((s, p) => {
      const price = quoteTicks[p.symbol]?.price ?? p.average_price
      return s + p.quantity * price
    }, 0)
    const totalCost = positions.reduce((s, p) => s + p.quantity * p.average_price, 0)
    const pl = totalValue - totalCost
    const plPct = totalCost ? (pl / totalCost) * 100 : 0
    return { totalValue, pl, plPct, up: pl >= 0 }
  }, [positions, quoteTicks])

  return (
    <div className="bg-[#121821] rounded-2xl border border-[#232c3a] p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Holdings</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {positions.length} positions · live valuation
          </p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold tabular-nums">${totalValue.toFixed(2)}</div>
          <div className={`text-xs tabular-nums ${up ? "text-bull" : "text-bear"}`}>
            {up ? "+" : ""}
            ${pl.toFixed(2)} ({up ? "+" : ""}
            {plPct.toFixed(2)}%) total P&L
          </div>
        </div>
      </div>

      {positions.length === 0 ? (
        <button
          onClick={onAdd}
          className="w-full border border-dashed border-[#232c3a] rounded-2xl py-12 flex flex-col items-center gap-2 text-slate-500 hover:text-amber-accent hover:border-border-amber/50 transition-colors cursor-pointer"
        >
          <Plus size={20} />
          <span className="text-sm">Add your first position</span>
        </button>
      ) : (
        <div className="space-y-2">
          {positions.map((p) => (
            <Row key={p.id} p={p} onDelete={() => handleDelete(p.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
