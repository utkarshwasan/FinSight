import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Newspaper, ChevronDown } from 'lucide-react'
import api from '@/lib/api'
import { DashboardShell } from '@/components/layout/DashboardShell'

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
  if (score >= 0.3) return 'text-bull bg-bull/10 border-bull/20'
  if (score <= -0.3) return 'text-bear bg-bear/10 border-bear/20'
  return 'text-amber-accent bg-amber/10 border-amber/20'
}

export default function NewsPage() {
  const [symbol, setSymbol] = useState('AAPL')

  const { data, isLoading } = useQuery<NewsItem[]>({
    queryKey: ['news', symbol],
    queryFn: () => api.get(`/news/${symbol}`).then((r) => r.data),
  })

  return (
    <DashboardShell 
      title="News Feed" 
      subtitle="Recent headlines and sentiment for selected symbols."
      actions={
        <div className="relative inline-block">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="appearance-none bg-[#161d27] border border-[#232c3a] text-slate-100 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium focus:outline-none focus:border-[#f5b454] focus:ring-2 focus:ring-amber/30 transition-all cursor-pointer shadow-lg shadow-black/20"
          >
            {symbols.map((s) => (
              <option key={s} className="bg-[#1c2532] text-slate-100" value={s}>
                {s}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
      }
    >
      <div className="bg-[#161d27] rounded-2xl border border-[#232c3a] p-6">
        {isLoading ? (
          <div className="space-y-4">
            <div className="shimmer h-24 rounded-xl w-full" />
            <div className="shimmer h-24 rounded-xl w-full" />
            <div className="shimmer h-24 rounded-xl w-full" />
          </div>
        ) : data && data.length > 0 ? (
          <div className="space-y-4">
            {data.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="group block rounded-2xl border border-[#232c3a] bg-[#1c2532] p-5 hover:border-amber/40 transition-all"
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber/10 flex items-center justify-center">
                      <Newspaper size={14} className="text-amber-accent" />
                    </div>
                    <span className="text-xs text-slate-400 font-medium">{item.source}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border uppercase tracking-wider ${sentimentTone(item.sentiment_score)}`}>
                    {item.sentiment_score === null || item.sentiment_score === undefined
                      ? 'N/A'
                      : item.sentiment_score.toFixed(2)}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-slate-100 leading-relaxed group-hover:text-amber-accent transition-colors">{item.headline}</h3>
                <p className="text-[11px] text-slate-500 mt-3 tabular-nums">
                  {new Date(item.published_at).toLocaleString()}
                </p>
              </a>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#1c2532] border border-[#232c3a] flex items-center justify-center mb-4">
              <Newspaper size={24} className="text-slate-700" />
            </div>
            <p className="text-sm text-slate-500">
              No news yet for {symbol}. Run a query to populate news via the agent pipeline.
            </p>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
