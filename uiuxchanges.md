Now I'll analyze your current frontend code and implement professional-grade UI/UX fixes. Let me examine the key files:

Now I'll create comprehensive UI/UX fixes for your FinSight application. Based on my research of professional financial dashboard designs and the UI/UX Pro Max principles, here are the critical fixes:

## 🎨 **CRITICAL UI/UX FIXES**

### **1. Fix NLQueryBar Component (Dropdown Visibility Issue)**

```tsx
// frontend/src/components/query/NLQueryBar.tsx
import { useState } from "react";
import { Send, Sparkles, ChevronDown } from "lucide-react";
import api from "@/lib/api";

export default function NLQueryBar({
  onRunStarted,
}: {
  onRunStarted: (runId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [symbol, setSymbol] = useState("AAPL");
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const { data } = await api.post("/query/", { query, symbol });
      onRunStarted(data.run_id);
      setQuery("");
    } catch (err) {
      console.error("Query failed", err);
    } finally {
      setLoading(false);
    }
  };

  const symbols = ["AAPL", "TSLA", "NVDA", "MSFT", "GOOGL", "AMZN", "META"];

  return (
    <div className="space-y-3">
      {/* Main Query Input */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <Sparkles className="absolute left-4 w-5 h-5 text-indigo-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Ask about ${symbol} (e.g., "Should I be concerned about TSLA today?")...`}
            className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl pl-12 pr-36 py-3.5 
                       focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 
                       transition-all placeholder:text-slate-500 text-sm"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 
                       disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium 
                       transition-all flex items-center gap-1.5"
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

      {/* Symbol Selector - Fixed Dropdown */}
      <div className="relative inline-block">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 
                     rounded-lg text-sm font-medium text-slate-200 transition-all"
        >
          <span className="text-indigo-400 font-semibold">{symbol}</span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
          />
        </button>

        {dropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setDropdownOpen(false)}
            />
            <div
              className="absolute top-full left-0 mt-2 w-48 bg-slate-800 border border-slate-600 
                          rounded-lg shadow-xl z-20 overflow-hidden"
            >
              {symbols.map((sym) => (
                <button
                  key={sym}
                  onClick={() => {
                    setSymbol(sym);
                    setDropdownOpen(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-slate-200 hover:bg-slate-700 
                           hover:text-indigo-400 transition-colors text-sm font-medium
                           border-b border-slate-700/50 last:border-0"
                >
                  {sym}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

### **2. Enhanced Add Position Button & Form**

```tsx
// Update the Add Position button in Overview.tsx
{
  showAddPosition && (
    <AddPositionForm onClose={() => setShowAddPosition(false)} />
  );
}

<button
  onClick={() => setShowAddPosition(true)}
  className="group relative px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 
             hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl 
             text-sm font-semibold transition-all duration-200 
             shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 
             border border-indigo-400/20 hover:border-indigo-400/40
             flex items-center gap-2 overflow-hidden"
>
  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
  <Plus className="w-4 h-4 relative z-10" />
  <span className="relative z-10">Add Position</span>
</button>;
```

### **3. Improved AddPositionForm Component**

```tsx
// frontend/src/components/positions/AddPositionForm.tsx
import { useState } from "react";
import { X } from "lucide-react";
import api from "@/lib/api";

export default function AddPositionForm({ onClose }: { onClose: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [avgPrice, setAvgPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/positions/", {
        symbol: symbol.toUpperCase(),
        quantity: parseFloat(quantity),
        avg_cost: parseFloat(avgPrice),
      });
      onClose();
    } catch (err) {
      console.error("Failed to add position", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Add New Position</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">Symbol</label>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g., NVDA"
              className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-600 rounded-xl 
                         text-white placeholder:text-slate-500 focus:outline-none 
                         focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 
                         transition-all uppercase font-semibold tracking-wide"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">
              Quantity
            </label>
            <input
              type="number"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-600 rounded-xl 
                         text-white placeholder:text-slate-500 focus:outline-none 
                         focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 
                         transition-all font-mono"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">
              Average Price ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={avgPrice}
              onChange={(e) => setAvgPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-600 rounded-xl 
                         text-white placeholder:text-slate-500 focus:outline-none 
                         focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 
                         transition-all font-mono"
              required
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white 
                         rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 
                         hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl 
                         font-semibold transition-all shadow-lg shadow-indigo-500/25 
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Adding..." : "Add to Portfolio"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### **4. Enhanced Overview Page Layout**

```tsx
// Update the main layout in Overview.tsx - Key sections
return (
  <div className="min-h-screen bg-slate-900 relative overflow-x-hidden">
    {/* Ambient Background */}
    <div className="ambient-blob ambient-blob-1" />
    <div className="ambient-blob ambient-blob-2" />

    <div className="relative z-10">
      {/* Header Section */}
      <header className="px-6 py-8 border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-indigo-400 text-sm font-semibold tracking-wider uppercase mb-1">
                Dashboard
              </p>
              <h1 className="text-4xl font-bold text-white mb-2 glow-text">
                Market Overview
              </h1>
              <p className="text-slate-400 text-sm">
                {user?.full_name
                  ? `Welcome back, ${user.full_name.split(" ")[0]}`
                  : "Welcome back"}
                {" • "}
                <span className="flex items-center gap-2 inline-flex">
                  <Clock className="w-4 h-4" />
                  {time.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAddPosition(true)}
                className="group relative px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 
                           hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl 
                           text-sm font-semibold transition-all duration-200 
                           shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 
                           border border-indigo-400/20 hover:border-indigo-400/40
                           flex items-center gap-2 overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <Plus className="w-4 h-4 relative z-10" />
                <span className="relative z-10">Add Position</span>
              </button>

              <div
                className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                  connected
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10"
                    : "bg-red-500/10 border-red-500/30 text-red-400"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`}
                  />
                  {connected ? "LIVE" : "OFFLINE"}
                </div>
              </div>
            </div>
          </div>

          {/* Market Tickers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {TICKERS.map((t) => {
              const live = quoteTicks[t.symbol as keyof typeof quoteTicks];
              const price = live
                ? (live as unknown as { price: number }).price
                : t.base;
              const changeVal = (t.change / 100) * t.base;
              return (
                <StatCard
                  key={t.symbol}
                  symbol={t.symbol}
                  price={price}
                  change={t.change}
                  changeVal={changeVal}
                  volume={t.volume}
                />
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Chart Section */}
        <section className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                AAPL Real-time Chart
              </h2>
              <p className="text-slate-400 text-sm">
                Live price movements with forecast projection
              </p>
            </div>
          </div>

          <div className="h-[400px]">
            <CandleChart
              data={candleData}
              forecast={formattedForecast}
              symbol="AAPL"
            />
          </div>

          {!hasLiveAapl && (
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2 text-amber-400 text-sm">
              <Activity className="w-4 h-4" />
              <span>
                Demo mode: Showing sample data until live market ticks arrive
              </span>
            </div>
          )}
        </section>

        {/* AI Copilot Section */}
        <section className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="w-6 h-6 text-indigo-400" />
              <h2 className="text-2xl font-bold text-white">AI Copilot</h2>
            </div>
            <p className="text-slate-400 text-sm mb-6">
              Ask natural language questions to get AI-powered financial
              insights with citations
            </p>
          </div>

          <div className="glass-card p-6 space-y-6">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-3 block">
                Ask a question about the market
              </label>
              <NLQueryBar onRunStarted={setCurrentRunId} />
            </div>

            <div className="border-t border-slate-700/50 pt-6">
              <div className="flex items-center gap-3 mb-4">
                <Cpu className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-semibold text-white">
                  Pipeline Execution
                </h3>
              </div>
              {currentRunId ? (
                <DAGVisualizer events={dagEvents} currentRunId={currentRunId} />
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <Cpu className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">
                    Submit a query from AI Copilot to start DAG execution
                  </p>
                </div>
              )}
            </div>

            {currentAnswer && <AnswerPanel answer={currentAnswer} />}
          </div>
        </section>

        {/* Portfolio & Watchlist Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Holdings - Takes 2 columns */}
          <div className="lg:col-span-2">
            <HoldingsCard positions={positions || []} />
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Watchlist */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-semibold text-white">Watchlist</h3>
              </div>
              {watchlist?.length ? (
                <div className="space-y-2">
                  {watchlist
                    .slice(0, 5)
                    .map((item: { id: number; symbol: string }) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between px-3 py-2.5 bg-slate-800/50 
                                 rounded-lg border border-slate-700/50 hover:border-indigo-500/30 
                                 transition-colors cursor-pointer group"
                      >
                        <span className="font-semibold text-slate-200 group-hover:text-indigo-400 transition-colors">
                          {item.symbol}
                        </span>
                        <div className="w-2 h-2 rounded-full bg-slate-600 group-hover:bg-indigo-400 transition-colors" />
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm py-4 text-center">
                  No symbols yet — add from Watchlist
                </p>
              )}
            </div>

            {/* Market Hours */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-semibold text-white">
                  Market Hours
                </h3>
              </div>
              <div className="space-y-3">
                {[
                  {
                    market: "NYSE / NASDAQ",
                    hours: "9:30 – 16:00 ET",
                    status: "Open",
                  },
                  {
                    market: "NSE / BSE",
                    hours: "9:15 – 15:30 IST",
                    status: "Closed",
                  },
                  { market: "Crypto", hours: "24 / 7", status: "Open" },
                ].map((m) => (
                  <div
                    key={m.market}
                    className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0"
                  >
                    <div>
                      <p className="text-slate-200 font-medium text-sm">
                        {m.market}
                      </p>
                      <p className="text-slate-500 text-xs">{m.hours}</p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        m.status === "Open"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-slate-700/50 text-slate-400 border border-slate-600"
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
);
```

### **5. Enhanced Design System (index.css)**

Add these improvements to your CSS:

```css
/* Add to index.css */

/* Better card shadows */
.shadow-card {
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
}

.shadow-glow {
  box-shadow: 0 8px 32px rgba(99, 102, 241, 0.35);
}

/* Improved spacing utilities */
.space-y-1\.5 > :not([hidden]) ~ :not([hidden]) {
  margin-top: 0.375rem;
}

/* Better focus states */
.focus-ring {
  transition: all 0.2s ease;
}

.focus-ring:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px var(--accent-glow);
}

/* Gradient text utility */
.gradient-text {
  background: linear-gradient(135deg, #818cf8 0%, #6366f1 50%, #a78bfa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Smooth transitions */
.transition-smooth {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Card hover effect */
.card-hover {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.card-hover:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
}

/* Better scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg-surface);
}

::-webkit-scrollbar-thumb {
  background: var(--border-light);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
```

## 📋 **NEXT STEPS**

After implementing these UI/UX fixes, you should:

1. **Test all components** for visual consistency
2. **Verify dropdown visibility** is fixed
3. **Check responsive design** on different screen sizes
4. **Test animations** and transitions for smoothness
5. **Ensure accessibility** (keyboard navigation, focus states)
