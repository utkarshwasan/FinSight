import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Plus, Trash2, Search } from 'lucide-react'
import api from '@/lib/api'
import { DashboardShell } from '@/components/layout/DashboardShell'

interface WatchlistItem {
  id: number
  symbol: string
}

export default function WatchlistPage() {
  const [symbol, setSymbol] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<WatchlistItem[]>({
    queryKey: ['watchlist'],
    queryFn: () => api.get('/watchlist').then((r) => r.data),
  })

  const addSymbol = async () => {
    const clean = symbol.trim().toUpperCase()
    if (!clean) return
    await api.post('/watchlist', { symbol: clean })
    setSymbol('')
    queryClient.invalidateQueries({ queryKey: ['watchlist'] })
  }

  const removeItem = async (id: number) => {
    await api.delete(`/watchlist/${id}`)
    queryClient.invalidateQueries({ queryKey: ['watchlist'] })
  }

  return (
    <DashboardShell 
      title="Watchlist" 
      subtitle="Track symbols for quotes, charts, and AI analysis."
    >
      <div className="space-y-6">
        <div className="bg-[#161d27] rounded-2xl border border-[#232c3a] p-5 flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSymbol()}
              placeholder="Add symbol (e.g. AAPL)"
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#1c2532] border border-[#232c3a] text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#f5b454] focus:ring-2 focus:ring-amber/30 transition-all"
            />
          </div>
          <button
            onClick={addSymbol}
            className="inline-flex items-center gap-2 px-6 h-11 rounded-xl bg-[#f5b454] hover:bg-[#f7c372] text-[#1a1207] text-sm font-semibold transition-all active:scale-[0.98] shadow-lg shadow-[#f5b454]/20 cursor-pointer"
          >
            <Plus size={16} />
            Add
          </button>
        </div>

        <div className="bg-[#161d27] rounded-2xl border border-[#232c3a] p-5">
          {isLoading ? (
            <div className="space-y-3">
              <div className="shimmer h-12 rounded-xl w-full" />
              <div className="shimmer h-12 rounded-xl w-full" />
              <div className="shimmer h-12 rounded-xl w-full" />
            </div>
          ) : data && data.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.map((item) => (
                <div key={item.id} className="group flex items-center justify-between rounded-xl border border-[#232c3a] bg-[#1c2532] px-4 py-3 hover:border-amber/30 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber/10 flex items-center justify-center">
                      <Eye size={14} className="text-amber-accent" />
                    </div>
                    <span className="font-semibold text-white">{item.symbol}</span>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-2 rounded-lg text-slate-500 hover:text-bear hover:bg-bear/10 transition-all cursor-pointer"
                    aria-label={`Remove ${item.symbol}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#1c2532] border border-[#232c3a] flex items-center justify-center mb-4">
                <Eye size={20} className="text-slate-600" />
              </div>
              <p className="text-sm text-slate-400">No symbols yet. Add at least one ticker.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}
