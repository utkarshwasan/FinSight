import { useState } from 'react'
import { Plus, X, Loader2, BriefcaseBusiness } from 'lucide-react'
import api from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'

export default function AddPositionForm({ onClose }: { onClose: () => void }) {
  const [symbol, setSymbol] = useState('')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/positions/', {
        symbol: symbol.toUpperCase(),
        quantity: parseFloat(quantity),
        average_price: parseFloat(price)
      })
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      onClose()
    } catch (err) {
      console.error("Failed to add position", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center">
            <BriefcaseBusiness size={16} className="text-indigo-300" />
          </div>
          <h2 className="text-xl font-bold text-white">Add Position</h2>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Symbol</label>
          <input
            type="text"
            required
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            placeholder="e.g. NVDA"
            className="w-full bg-slate-800/50 border border-slate-700 text-white uppercase rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            maxLength={10}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Quantity</label>
            <input
              type="number"
              step="any"
              required
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Avg Price</label>
            <input
              type="number"
              step="any"
              required
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 rounded-lg transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
            Add
          </button>
        </div>
      </form>
    </div>
  )
}
