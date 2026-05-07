import { ChevronDown, Check, Loader2, Activity } from "lucide-react"
import { useEffect, useState } from "react"
import { useWsStore } from "@/store/wsStore"

type Status = "idle" | "running" | "done" | "error" | "skipped"

const NODES = [
  { id: "MarketData", label: "Fetch",        sub: "yfinance + Finnhub", x: 30,  y: 50  },
  { id: "News",       label: "News",         sub: "Sentiment NER",      x: 220, y: 30  },
  { id: "Forecast",   label: "Forecast",     sub: "Forecast 7d",         x: 220, y: 130 },
  { id: "Risk",       label: "Synthesize",   sub: "Gemini 2.0 Flash",   x: 410, y: 80  },
  { id: "Alert",      label: "Cite & Verify",sub: "Citation guard",     x: 600, y: 80  },
]
const EDGES: Array<[string, string]> = [
  ["MarketData", "News"],
  ["MarketData", "Forecast"],
  ["News", "Risk"],
  ["Forecast", "Risk"],
  ["Risk", "Alert"],
]

export function DAGVisualizer({ runToken, currentRunId }: { runToken: number; currentRunId: string | null }) {
  const [open, setOpen] = useState(false)
  const [statuses, setStatuses] = useState<Record<string, Status>>(
    Object.fromEntries(NODES.map((n) => [n.id, "idle"]))
  )
  const dagEvents = useWsStore((s) => s.dagEvents)

  // Drive from real WS events when a run is active
  useEffect(() => {
    if (!currentRunId) return
    const runEvents = dagEvents.filter((e) => e.run_id === currentRunId)
    if (runEvents.length === 0) return
    const next: Record<string, Status> = Object.fromEntries(NODES.map((n) => [n.id, "idle"]))
    for (const ev of runEvents) {
      if (ev.node in next) next[ev.node] = ev.status as Status
    }
    setStatuses(next)
  }, [dagEvents, currentRunId])

  // Animate demo when no real run
  useEffect(() => {
    if (!runToken || currentRunId) return
    setOpen(true)
    setStatuses(Object.fromEntries(NODES.map((n) => [n.id, "idle"])))

    const order = NODES.map((n) => n.id)
    const timers: ReturnType<typeof setTimeout>[] = []

    order.forEach((id, i) => {
      timers.push(setTimeout(() => setStatuses((s) => ({ ...s, [id]: "running" })), i * 350))
      timers.push(setTimeout(() => setStatuses((s) => ({ ...s, [id]: "done" })), i * 350 + 500))
    })

    return () => timers.forEach(clearTimeout)
  }, [runToken])

  // Auto-open when a real run starts
  useEffect(() => { if (currentRunId) setOpen(true) }, [currentRunId])

  const nodeById = (id: string) => NODES.find((n) => n.id === id)!
  const hasRun = runToken > 0 || !!currentRunId
  const doneCount = Object.values(statuses).filter((s) => s === "done").length
  const totalLatency = dagEvents
    .filter(e => e.run_id === currentRunId && e.status === "done")
    .reduce((sum, e) => sum + e.latency_ms, 0)

  return (
    <div className="bg-[#161d27] rounded-2xl border border-[#232c3a] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber/15 text-amber-accent flex items-center justify-center">
            <Activity size={15} />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold">Agent DAG</div>
            <div className="text-[11px] text-slate-500">5 nodes · live execution trace</div>
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-[#232c3a] p-4">
          {!hasRun ? (
            <div className="h-[260px] flex items-center justify-center text-center px-6">
              <div>
                <div className="w-10 h-10 mx-auto rounded-full bg-amber/10 flex items-center justify-center mb-3">
                  <Activity size={16} className="text-amber-accent" />
                </div>
                <p className="text-sm text-slate-400">Idle</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Submit a query to start DAG execution
                </p>
              </div>
            </div>
          ) : (
            <div className="relative">
              <svg viewBox="0 0 720 200" className="w-full h-[220px]">
                {EDGES.map(([from, to], i) => {
                  const a = nodeById(from)
                  const b = nodeById(to)
                  const sourceRunning = statuses[from] === "running"
                  const sourceDone = statuses[from] === "done"
                  const stroke = sourceDone || sourceRunning ? "#f5b454" : "#3a3a3a"
                  return (
                    <line
                      key={i}
                      x1={a.x + 70}
                      y1={a.y + 30}
                      x2={b.x}
                      y2={b.y + 30}
                      stroke={stroke}
                      strokeWidth="1.5"
                      className={sourceRunning ? "edge-march" : ""}
                    />
                  )
                })}
                {NODES.map((n) => {
                  const st = statuses[n.id]
                  return (
                    <foreignObject key={n.id} x={n.x} y={n.y} width="140" height="64">
                      <div
                        className={[
                          "h-full w-full rounded-xl border px-2.5 py-2 flex items-center gap-2 bg-[#121821]",
                          st === "running"
                            ? "border-[#f5b454] dag-pulse"
                            : st === "done"
                              ? "border-emerald-500/50"
                              : st === "error"
                                ? "border-red-500/50"
                                : "border-[#232c3a]",
                        ].join(" ")}
                      >
                        <div
                          className={[
                            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                            st === "running"
                              ? "bg-amber/20 text-amber-accent"
                              : st === "done"
                                ? "bg-emerald-500/15 text-bull"
                                : st === "error"
                                  ? "bg-red-500/15 text-bear"
                                  : "bg-white/5 text-slate-500",
                          ].join(" ")}
                        >
                          {st === "running" ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : st === "done" ? (
                            <Check size={13} />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12px] font-semibold leading-tight truncate">
                            {n.label}
                          </div>
                          <div className="text-[10px] text-slate-500 leading-tight truncate">
                            {n.sub}
                          </div>
                        </div>
                      </div>
                    </foreignObject>
                  )
                })}
              </svg>

               <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-[#232c3a]">
                 <span>{currentRunId ? currentRunId.slice(0, 12) : "run_demo"}</span>
                 <span className="tabular-nums">
                   {doneCount}/5 ·
                   <span className="text-bull ml-1">
                     {currentRunId ? totalLatency : doneCount * 312}ms
                   </span>
                 </span>
               </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
