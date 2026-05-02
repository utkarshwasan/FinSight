import { Handle, Position } from 'reactflow'
import { Activity, Newspaper, TrendingUp, ShieldAlert, Bell, Cpu, CheckCircle2, XCircle } from 'lucide-react'

const ICON_MAP = {
  MarketData: Activity,
  News: Newspaper,
  Forecast: TrendingUp,
  Risk: ShieldAlert,
  Alert: Bell,
  Synthesis: Cpu,
}

export default function AgentNode({ data }: { data: { label: string, status: string, latency_ms?: number } }) {
  const Icon = ICON_MAP[data.label as keyof typeof ICON_MAP] || Cpu

  const isRunning = data.status === 'running'
  const isDone = data.status === 'done'
  const isError = data.status === 'error'
  const isSkipped = data.status === 'skipped'
  const isPending = !isRunning && !isDone && !isError && !isSkipped

  return (
    <div className={`relative flex items-center gap-3 px-4 py-2 rounded-xl border ${
      isRunning ? 'border-#f5b454 bg-amber/10' :
      isDone ? 'border-emerald-500/30 bg-slate-900' :
      isError ? 'border-rose-500/50 bg-rose-500/10' :
      isSkipped ? 'border-slate-500/50 bg-slate-500/10' :
      'border-slate-800 bg-slate-900/50'
    } shadow-lg transition-all duration-300`} style={{ minWidth: 160 }}>
      
      {/* Pulse ring when running */}
      {isRunning && (
        <div className="absolute inset-0 -m-1 border border-#f5b454/50 rounded-xl animate-ping opacity-20" />
      )}
      
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-slate-700 border-none" />
      
      <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${
        isRunning ? 'bg-[#f5b454] text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' :
        isDone ? 'bg-emerald-500/20 text-emerald-400' :
        isError ? 'bg-rose-500/20 text-rose-400' :
        isSkipped ? 'bg-slate-500/20 text-slate-400' :
        'bg-slate-800 text-slate-400'
      }`}>
        <Icon size={14} />
      </div>
      
      <div className="flex-1">
        <div className="text-sm font-semibold text-slate-200">{data.label}</div>
        <div className="text-[10px] text-slate-400 flex items-center gap-1">
          {isRunning && <span className="text-amber-accent font-medium">Running...</span>}
          {isDone && <span className="text-emerald-400 font-medium flex items-center gap-1"><CheckCircle2 size={10} /> {data.latency_ms || 0}ms</span>}
          {isError && <span className="text-rose-400 font-medium flex items-center gap-1"><XCircle size={10} /> Failed</span>}
          {isSkipped && <span className="text-slate-400 font-medium">Skipped</span>}
          {isPending && <span>Standby</span>}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-slate-700 border-none" />
    </div>
  )
}
