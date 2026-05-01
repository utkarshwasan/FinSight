import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Newspaper } from 'lucide-react'
import api from '@/lib/api'

interface NewsItem {
  id: number
  symbol: string
  headline: string
  source: string
  url: string
  published_at: string
  sentiment_score?: number | null
}

const symbols = ['AAPL', 'TSLA', 'NVDA', 'MSFT']

function sentimentTone(score?: number | null) {
  if (score === null || score === undefined) return 'text-slate-400 bg-slate-800/60 border-slate-700'
  if (score >= 0.3) return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
  if (score <= -0.3) return 'text-rose-300 bg-rose-500/10 border-rose-500/20'
  return 'text-amber-300 bg-amber-500/10 border-amber-500/20'
}

export default function NewsPage() {
  const [symbol, setSymbol] = useState('AAPL')

  const { data, isLoading } = useQuery<NewsItem[]>({
    queryKey: ['news', symbol],
    queryFn: () => api.get(`/news/${symbol}`).then((r) => r.data),
  })

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">News Feed</h1>
          <p className="text-sm text-slate-400">Recent headlines and sentiment for selected symbols.</p>
        </div>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        >
          {symbols.map((s) => (
            <option key={s} className="bg-slate-900 text-slate-100" value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="glass-card p-5">
        {isLoading ? (
          <p className="text-sm text-slate-400">Loading news...</p>
        ) : data && data.length > 0 ? (
          <div className="space-y-3">
            {data.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-slate-800 bg-slate-900/30 p-4 hover:border-slate-600 transition-all"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <Newspaper size={14} className="text-indigo-300" />
                    <span className="text-xs text-slate-400">{item.source}</span>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-md border ${sentimentTone(item.sentiment_score)}`}>
                    {item.sentiment_score === null || item.sentiment_score === undefined
                      ? 'N/A'
                      : item.sentiment_score.toFixed(2)}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white leading-6">{item.headline}</h3>
                <p className="text-xs text-slate-500 mt-2">
                  {new Date(item.published_at).toLocaleString()}
                </p>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No news yet for {symbol}. Run a query to populate news via the agent pipeline.
          </p>
        )}
      </div>
    </div>
  )
}
