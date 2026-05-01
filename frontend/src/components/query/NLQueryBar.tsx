import { useState } from 'react'
import { Send, Sparkles, ChevronDown } from 'lucide-react'
import api from '@/lib/api'

export default function NLQueryBar({ onRunStarted }: { onRunStarted: (runId: string) => void }) {
  const [query, setQuery] = useState('')
  const [symbol, setSymbol] = useState('AAPL') // Default for demo
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!query.trim()) return
    
    setLoading(true)
    try {
      const { data } = await api.post('/query/', { query, symbol })
      onRunStarted(data.run_id)
      setQuery('')
    } catch (err) {
      console.error("Query failed", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 items-stretch">
      <div className="relative flex-1 min-w-0">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Sparkles size={16} className="text-indigo-400" />
        </div>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Ask a question about ${symbol}...`}
          className="w-full bg-slate-900/60 border border-slate-700 text-white rounded-lg pl-10 pr-32 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-500"
          disabled={loading}
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <div className="relative">
            <select
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              className="appearance-none bg-slate-800 border border-slate-700 text-slate-100 text-sm font-semibold rounded-md pl-3 pr-7 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              aria-label="Select ticker"
            >
              <option className="bg-slate-900 text-slate-100" value="AAPL">AAPL</option>
              <option className="bg-slate-900 text-slate-100" value="TSLA">TSLA</option>
              <option className="bg-slate-900 text-slate-100" value="NVDA">NVDA</option>
              <option className="bg-slate-900 text-slate-100" value="MSFT">MSFT</option>
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      </div>

      <button
        type="submit" 
        disabled={loading || !query.trim()}
        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] flex items-center gap-2"
      >
        <Send size={16} />
      </button>
    </form>
  )
}
