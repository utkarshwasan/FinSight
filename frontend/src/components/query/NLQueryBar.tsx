import { useState, useRef, useEffect } from "react"
import { Send, Sparkles, ChevronDown } from "lucide-react"
import api from "@/lib/api"

const SYMBOLS = ["AAPL", "TSLA", "NVDA", "MSFT", "GOOGL", "AMZN", "META"]

export default function NLQueryBar({
  onRunStarted,
}: {
  onRunStarted: (runId: string) => void;
}) {
  const [query, setQuery] = useState("")
  const [symbol, setSymbol] = useState("AAPL")
  const [loading, setLoading] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    try {
      const { data } = await api.post("/query/", { query, symbol })
      onRunStarted(data.run_id)
      setQuery("")
    } catch (err) {
      console.error("Query failed", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <Sparkles className="absolute left-4 w-5 h-5 text-sky-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Ask about ${symbol} (e.g. "Should I be concerned about ${symbol} today?")...`}
            className="w-full bg-[#161d27] border border-[#232c3a] text-white rounded-xl pl-12 pr-36 py-3.5 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all placeholder:text-slate-500 text-sm"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all flex items-center gap-1.5"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Ask</span>
              </>
            )}
          </button>
        </div>
      </form>

      <div className="relative inline-block" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-[#161d27] hover:bg-[#232c3a] border border-[#232c3a] rounded-lg text-sm font-semibold transition-all"
        >
          <span className="text-sky-400">{symbol}</span>
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
          />
        </button>

        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-2 w-40 bg-[#161d27] border border-[#232c3a] rounded-xl shadow-2xl z-50 overflow-hidden">
            {SYMBOLS.map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => { setSymbol(sym); setDropdownOpen(false) }}
                className={`w-full px-4 py-2.5 text-left text-sm font-semibold transition-colors border-b border-[#232c3a] last:border-0 ${
                  sym === symbol
                    ? "text-sky-400 bg-sky-500/10"
                    : "text-slate-200 hover:text-sky-400 hover:bg-[#232c3a]"
                }`}
              >
                {sym}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
