import { useState } from "react";
import { X, BriefcaseBusiness } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export default function AddPositionForm({ onClose }: { onClose: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [avgPrice, setAvgPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/positions/", {
        symbol: symbol.toUpperCase(),
        quantity: parseFloat(quantity),
        average_price: parseFloat(avgPrice),
      });
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      onClose();
    } catch (err) {
      console.error("Failed to add position", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#121821] border border-[#232c3a] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber/20 border border-amber-accent/20 flex items-center justify-center">
              <BriefcaseBusiness size={18} className="text-amber-accent" />
            </div>
            <h2 className="text-xl font-bold text-white">Add New Position</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="pos-symbol" className="text-sm font-medium text-slate-300 block">Symbol</label>
            <input
              id="pos-symbol"
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. NVDA"
              maxLength={10}
              required
              className="w-full px-4 py-3 bg-[#161d27] border border-[#232c3a] rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-[#f5b454] focus:ring-2 focus:ring-amber/20 transition-all uppercase font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="pos-qty" className="text-sm font-medium text-slate-300 block">Quantity</label>
              <input
                id="pos-qty"
                type="number"
                step="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.00"
                required
                className="w-full px-4 py-3 bg-[#161d27] border border-[#232c3a] rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-[#f5b454] focus:ring-2 focus:ring-amber/20 transition-all font-mono"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="pos-price" className="text-sm font-medium text-slate-300 block">Avg Price ($)</label>
              <input
                id="pos-price"
                type="number"
                step="0.01"
                value={avgPrice}
                onChange={(e) => setAvgPrice(e.target.value)}
                placeholder="0.00"
                required
                className="w-full px-4 py-3 bg-[#161d27] border border-[#232c3a] rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-[#f5b454] focus:ring-2 focus:ring-amber/20 transition-all font-mono"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-3 bg-[#f5b454] hover:bg-[#f5b454] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-lg shadow-[#f5b454]/25 flex items-center justify-center gap-2">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Add to Portfolio"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
