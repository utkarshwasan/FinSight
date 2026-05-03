import { Sparkles, Send, ChevronDown, ArrowUpRight } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import api from "@/lib/api"
import { useWsStore } from "@/store/wsStore"
import { useWatchlist } from "@/lib/queries/watchlist"

const SUGGESTIONS = [
  "Why did AAPL drop today?",
  "Compare NVDA vs AMD momentum",
  "Sentiment on TSLA this week",
  "Forecast MSFT next 7 days",
]

type Props = { onRun: (runId?: string) => void }

export function AICopilot({ onRun }: Props) {
  const [query, setQuery] = useState("")
  const [symbol, setSymbol] = useState("AAPL")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState<string | null>(null)
  const [sources, setSources] = useState<any[]>([])
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const answersByRun = useWsStore((s) => s.answersByRun)
  const { data: wl = [] } = useWatchlist()
  const symbols = wl.length > 0 ? wl.map((w) => w.symbol) : ["AAPL", "NVDA", "TSLA", "MSFT", "GOOGL"]

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  // Watch for query completion from DAG via WebSocket
  useEffect(() => {
    if (!currentRunId) return
    const result = answersByRun[currentRunId]
    if (result) {
      setLoading(false)
      setAnswer(result.answer)
      setSources(result.sources || [])
    }
  }, [answersByRun, currentRunId])

  async function submit() {
    if (!query.trim()) return
    setLoading(true)
    setAnswer(null)
    setSources([])
    try {
      const { data } = await api.post("/query/", { query, symbol })
      setCurrentRunId(data.run_id)
      onRun(data.run_id)
    } catch {
      setLoading(false)
      setAnswer("[error] Could not reach analysis service. Please check your connection and retry.")
      setSources([])
    }
  }

  return (
    <div className="bg-[#161d27] rounded-2xl border border-[#232c3a] p-6 space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber/15 text-amber-accent flex items-center justify-center">
            <Sparkles size={15} />
          </div>
          <h3 className="text-base font-semibold tracking-tight">AI Copilot</h3>
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber/10 text-amber-accent border border-amber/20">
            Gemini · 5-agent DAG
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1.5">
          Ask a natural-language question. Every numeric claim is citation-enforced.
        </p>
      </div>

      <div className="flex gap-2.5">
        {/* Symbol dropdown */}
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="h-[50px] px-3.5 rounded-xl bg-[#161d27] border border-[#232c3a] hover:border-border-amber/50 text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span>{symbol}</span>
            <ChevronDown
              size={14}
              className={`text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </button>
          {open && (
            <div className="absolute top-[58px] left-0 z-50 w-32 bg-[#161d27] border border-[#232c3a] rounded-xl shadow-2xl py-1 overflow-hidden">
              {symbols.map((s) => (
                <button
                  key={s}
                  onClick={() => { setSymbol(s); setOpen(false) }}
                  className={[
                    "w-full text-left px-3.5 py-2 text-sm text-white hover:bg-[#232c3a] transition-colors cursor-pointer",
                    s === symbol ? "bg-amber/10 text-amber-accent" : "",
                  ].join(" ")}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="relative flex-1">
          <Sparkles size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-accent" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Ask about a ticker, trend, or forecast…"
            className="w-full h-[50px] pl-12 pr-36 rounded-xl bg-[#161d27] border border-[#232c3a] text-sm placeholder:text-slate-600 focus:outline-none focus:border-#f5b454 focus:ring-2 focus:ring-amber/20 transition-all"
          />
          <button
            onClick={submit}
            disabled={!query.trim() || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-[38px] px-4 rounded-lg bg-[#f5b454] hover:bg-amber-accent disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
          >
            {loading ? "Running…" : (<>Run <Send size={13} /></>)}
          </button>
        </div>
      </div>

      {/* Suggestions */}
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setQuery(s)}
            className="px-2.5 py-1 text-xs text-slate-400 bg-white/[0.03] border border-[#232c3a] rounded-full hover:border-border-amber/50 hover:text-white transition-colors cursor-pointer"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Answer panel */}
      {(loading || answer) && (
        <div className="rounded-xl bg-[#121821] border border-[#232c3a] border-t-2 border-t-#f5b454 p-4">
          {loading ? (
            <div className="space-y-2.5">
              <div className="shimmer h-3 rounded w-[88%]" />
              <div className="shimmer h-3 rounded w-[72%]" />
              <div className="shimmer h-3 rounded w-[60%]" />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-slate-200">{answer}</p>
              <div className="flex flex-wrap gap-2 pt-1 border-t border-[#232c3a]">
                {sources.length > 0 ? (
                  sources.map((c: any, idx: number) => (
                    <a
                      key={c.n ?? idx}
                      href={c.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-amber-accent hover:text-amber-accent flex items-center gap-1 cursor-pointer"
                    >
                      [{c.n ?? idx + 1}] {c.src || c.source || c.headline?.slice(0, 40) || "Source"}
                      <ArrowUpRight size={11} />
                    </a>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-500">No citations available</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
