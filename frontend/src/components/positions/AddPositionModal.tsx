import { X, Loader2 } from "lucide-react"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"

export function AddPositionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [symbol, setSymbol] = useState("")
  const [quantity, setQuantity] = useState("")
  const [avgPrice, setAvgPrice] = useState("")
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

  if (!open) return null

  const handleSubmit = async () => {
    if (!symbol || !quantity || !avgPrice) return
    setLoading(true)
    try {
      await api.post("/positions/", {
        symbol: symbol.toUpperCase(),
        quantity: parseFloat(quantity),
        average_price: parseFloat(avgPrice),
      })
      queryClient.invalidateQueries({ queryKey: ["positions"] })
      setSymbol("")
      setQuantity("")
      setAvgPrice("")
      onClose()
    } catch (err) {
      console.error("Failed to add position", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#121821] rounded-2xl border border-[#232c3a] p-6 space-y-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Add Position</h3>
            <p className="text-xs text-slate-500 mt-1">Track a new holding in your portfolio.</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 flex items-center justify-center cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400">Symbol</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. AAPL"
              maxLength={10}
              className="w-full px-4 py-3 bg-[#161d27] border border-[#232c3a] rounded-xl text-sm placeholder:text-slate-600 focus:outline-none focus:border-#f5b454 focus:ring-2 focus:ring-amber/20 transition-all uppercase font-semibold"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400">Quantity</label>
            <input
              type="number"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 25"
              className="w-full px-4 py-3 bg-[#161d27] border border-[#232c3a] rounded-xl text-sm placeholder:text-slate-600 focus:outline-none focus:border-#f5b454 focus:ring-2 focus:ring-amber/20 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400">Average cost (USD)</label>
            <input
              type="number"
              step="0.01"
              value={avgPrice}
              onChange={(e) => setAvgPrice(e.target.value)}
              placeholder="e.g. 165.40"
              className="w-full px-4 py-3 bg-[#161d27] border border-[#232c3a] rounded-xl text-sm placeholder:text-slate-600 focus:outline-none focus:border-#f5b454 focus:ring-2 focus:ring-amber/20 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !symbol || !quantity || !avgPrice}
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-[#f5b454] hover:bg-amber-accent text-white flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Add Position
          </button>
        </div>
      </div>
    </div>
  )
}
