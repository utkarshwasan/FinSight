import { useEffect } from "react"
import { X, AlertTriangle } from "lucide-react"
import { useWsStore } from "@/store/wsStore"

const AUTO_DISMISS_MS = 5000

function Toast({ id, symbol, message, price }: { id: string; symbol: string; message: string; price: number }) {
  const dismiss = useWsStore((s) => s.dismissAlert)

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const t = setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [id, dismiss])

  return (
    <div className="flex items-start gap-3 bg-[#1c2532] border border-bear/40 rounded-2xl px-4 py-3 shadow-xl shadow-black/40 min-w-[280px] max-w-[360px] animate-slide-in">
      <div className="w-8 h-8 rounded-lg bg-bear/15 flex items-center justify-center shrink-0 mt-0.5">
        <AlertTriangle size={15} className="text-bear" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-slate-100">
          {symbol} Alert
        </div>
        <div className="text-[12px] text-slate-400 mt-0.5 truncate">
          {message} · <span className="tabular-nums text-bear font-medium">${price.toFixed(2)}</span>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-0.5 rounded-full bg-[#232c3a] overflow-hidden">
          <div
            className="h-full bg-bear rounded-full"
            style={{ animation: `shrink ${AUTO_DISMISS_MS}ms linear forwards` }}
          />
        </div>
      </div>
      <button
        onClick={() => dismiss(id)}
        className="text-slate-500 hover:text-slate-200 transition-colors cursor-pointer mt-0.5 shrink-0"
        aria-label="Dismiss alert"
      >
        <X size={15} />
      </button>
    </div>
  )
}

export function AlertToast() {
  const alerts = useWsStore((s) => s.alerts)
  if (alerts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {alerts.map((a) => (
        <div key={a._id} className="pointer-events-auto">
          <Toast id={a._id} symbol={a.symbol} message={a.message} price={a.price} />
        </div>
      ))}
    </div>
  )
}
