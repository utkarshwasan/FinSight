import { useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { useWsStore } from '@/store/wsStore'
import api from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'

interface Position {
  id: number
  symbol: string
  quantity: number
  average_price: number
}

export default function HoldingsCard({ positions }: { positions: Position[] }) {
  const quoteTicks = useWsStore((s) => s.quoteTicks)
  const queryClient = useQueryClient()

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/positions/${id}`)
      queryClient.invalidateQueries({ queryKey: ['positions'] })
    } catch (err) {
      console.error("Delete failed", err)
    }
  }

  const totals = useMemo(() => {
    let marketValue = 0
    let costBasis = 0
    
    positions.forEach(p => {
      const live = quoteTicks[p.symbol]
      const currentPrice = live ? live.price : p.average_price
      marketValue += currentPrice * p.quantity
      costBasis += p.average_price * p.quantity
    })
    
    const pnl = marketValue - costBasis
    const pnlPct = costBasis !== 0 ? (pnl / costBasis) * 100 : 0
    
    return { marketValue, costBasis, pnl, pnlPct }
  }, [positions, quoteTicks])

  return (
    <div className="glass-card p-6 rounded-2xl border border-slate-800 bg-slate-900/50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Your Holdings</h2>
          <p className="text-xs text-slate-400">Live Portfolio Performance</p>
        </div>
        <div className="text-right">
          <div className={`text-xl font-bold tabular-nums ${totals.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totals.pnl >= 0 ? '+' : ''}${totals.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-xs font-semibold ${totals.pnl >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
            {totals.pnl >= 0 ? '+' : ''}{totals.pnlPct.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {positions.map(p => {
          const live = quoteTicks[p.symbol]
          const currentPrice = live ? live.price : p.average_price
          const pnl = (currentPrice - p.average_price) * p.quantity
          const pnlPct = (pnl / (p.average_price * p.quantity)) * 100
          
          return (
            <div key={p.id} className="group flex items-center justify-between p-3 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:border-slate-600 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-slate-200 text-xs">
                  {p.symbol}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{p.symbol}</div>
                  <div className="text-[10px] text-slate-500">{p.quantity} shares @ ${p.average_price}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm font-bold text-white tabular-nums">${(currentPrice * p.quantity).toLocaleString()}</div>
                  <div className={`text-[10px] font-medium tabular-nums ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                  </div>
                </div>
                <button 
                  onClick={() => handleDelete(p.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-rose-400 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )
        })}
        
        {positions.length === 0 && (
          <div className="py-8 text-center border-2 border-dashed border-slate-800 rounded-xl">
            <p className="text-sm text-slate-500">No positions yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
