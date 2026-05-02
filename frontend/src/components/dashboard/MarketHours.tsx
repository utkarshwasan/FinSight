import { Clock } from "lucide-react"

const MARKETS = [
  { name: "NYSE",   status: "Open",   time: "10:32 ET",  up: true  },
  { name: "NASDAQ", status: "Open",   time: "10:32 ET",  up: true  },
  { name: "LSE",    status: "Open",   time: "15:32 GMT", up: true  },
  { name: "NSE",    status: "Closed", time: "20:02 IST", up: false },
]

export function MarketHours() {
  return (
    <div className="bg-[#121821] rounded-2xl border border-[#232c3a] p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={14} className="text-slate-500" />
        <h3 className="text-sm font-semibold tracking-tight">Market Hours</h3>
      </div>
      <div className="space-y-2.5">
        {MARKETS.map((m) => (
          <div key={m.name} className="flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${m.up ? "bg-bull live-dot" : "bg-slate-600"}`}
              />
              <span className="font-medium">{m.name}</span>
            </div>
            <div className="flex items-center gap-2 tabular-nums text-slate-500">
              <span className={m.up ? "text-bull" : "text-slate-500"}>{m.status}</span>
              <span className="text-slate-700">·</span>
              <span>{m.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
