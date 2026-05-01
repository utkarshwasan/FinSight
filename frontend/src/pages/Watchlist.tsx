import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Plus, Trash2 } from 'lucide-react'
import api from '@/lib/api'

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
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Watchlist</h1>
        <p className="text-sm text-slate-400">Track symbols for quotes, charts, and AI analysis.</p>
      </div>

      <div className="glass-card p-4 flex items-center gap-3">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="Add symbol (e.g. AAPL)"
          className="flex-1 bg-slate-900/60 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        <button
          onClick={addSymbol}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all"
        >
          <Plus size={16} />
          Add
        </button>
      </div>

      <div className="glass-card p-5">
        {isLoading ? (
          <p className="text-sm text-slate-400">Loading watchlist...</p>
        ) : data && data.length > 0 ? (
          <div className="space-y-2">
            {data.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Eye size={14} className="text-indigo-300" />
                  <span className="font-semibold text-white">{item.symbol}</span>
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-2 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                  aria-label={`Remove ${item.symbol}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No symbols yet. Add at least one ticker.</p>
        )}
      </div>
    </div>
  )
}
