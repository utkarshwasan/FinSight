### File: `frontend/src/components/auth/ProtectedRoute.tsx`
```typescript
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
```

---

### File: `frontend/src/components/layout/DashboardShell.tsx`
```typescript
import { Menu } from "lucide-react"
import { Sidebar } from "./Sidebar"
import type { ReactNode } from "react"

type Props = {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}

export function DashboardShell({ title, subtitle, actions, children }: Props) {
  return (
    <div className="min-h-screen flex bg-[#0b1015]">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-[1280px] mx-auto px-6 py-8 space-y-8">
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <button className="lg:hidden w-9 h-9 rounded-lg bg-[#161d27] border border-[#232c3a] flex items-center justify-center cursor-pointer">
                  <Menu size={16} />
                </button>
                <h1 className="text-2xl sm:text-[28px] font-display font-semibold tracking-tight">
                  {title}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-bull/10 border border-emerald-500/20 text-bull text-[11px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-bull live-dot" />
                  Live
                </span>
              </div>
              {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
            </div>
            {actions}
          </header>

          {children}

          <footer className="text-[11px] text-slate-600 pt-4 pb-2 text-center">
            FinSight AI · Educational use only · Forecasts are illustrative, not investment advice.
          </footer>
        </div>
      </main>
    </div>
  )
}
```

---

### File: `frontend/src/components/layout/DashboardLayout.tsx`
```typescript
import { Sidebar } from "./Sidebar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex text-foreground">
      <Sidebar />
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
```

---

### File: `frontend/src/components/layout/Navbar.tsx`
```typescript
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/authStore"
import { LayoutDashboard, LogOut, User } from "lucide-react"

export default function Navbar() {
  const { user, logout } = useAuthStore()

  return (
    <nav className="h-16 border-b border-slate-800 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-50 flex items-center justify-between px-6">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <LayoutDashboard className="text-white w-5 h-5" />
        </div>
        <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          FinSight
        </span>
      </div>

      <div className="flex items-center gap-4">
        {user ? (
          <>
            <div className="flex items-center gap-2 text-slate-300">
              <User className="w-4 h-4" />
              <span className="text-sm font-medium">{user.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="text-slate-400 hover:text-rose-400">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </>
        ) : (
          <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white">
            Sign In
          </Button>
        )}
      </div>
    </nav>
  )
}
```

---

### File: `frontend/src/components/positions/AddPositionForm.tsx`
```typescript
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
              className="w-full px-4 py-3 bg-[#161d27] border border-[#232c3a] rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-#f5b454 focus:ring-2 focus:ring-amber/20 transition-all uppercase font-semibold"
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
                className="w-full px-4 py-3 bg-[#161d27] border border-[#232c3a] rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-#f5b454 focus:ring-2 focus:ring-amber/20 transition-all font-mono"
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
                className="w-full px-4 py-3 bg-[#161d27] border border-[#232c3a] rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-#f5b454 focus:ring-2 focus:ring-amber/20 transition-all font-mono"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-3 bg-[#f5b454] hover:bg-[#f5b454] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-lg shadow-amber/20 flex items-center justify-center gap-2">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Add to Portfolio"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

### File: `frontend/src/components/Markets.tsx`
```typescript
import { useEffect, useMemo, useState } from "react"
import { Search, ArrowUpDown, TrendingUp, TrendingDown } from "lucide-react"
import { DashboardShell } from "@/components/layout/DashboardShell"

type Row = {
  symbol: string
  name: string
  sector: string
  price: number
  change: number
  volume: string
  cap: string
}

const INITIAL: Row[] = [
  { symbol: "AAPL", name: "Apple Inc.", sector: "Tech", price: 178.42, change: -1.21, volume: "52.4M", cap: "2.78T" },
  { symbol: "NVDA", name: "NVIDIA Corp.", sector: "Semis", price: 612.88, change: 2.84, volume: "38.1M", cap: "1.51T" },
  { symbol: "MSFT", name: "Microsoft", sector: "Tech", price: 414.22, change: 0.62, volume: "21.7M", cap: "3.08T" },
  { symbol: "TSLA", name: "Tesla", sector: "Auto", price: 219.6, change: -3.18, volume: "118.2M", cap: "698B" },
  { symbol: "GOOGL", name: "Alphabet", sector: "Tech", price: 142.31, change: 0.42, volume: "29.0M", cap: "1.78T" },
  { symbol: "AMZN", name: "Amazon", sector: "Retail", price: 178.9, change: -0.18, volume: "44.6M", cap: "1.86T" },
  { symbol: "META", name: "Meta Platforms", sector: "Tech", price: 488.65, change: 1.12, volume: "18.4M", cap: "1.24T" },
  { symbol: "AMD", name: "Advanced Micro", sector: "Semis", price: 152.4, change: -0.95, volume: "55.2M", cap: "246B" },
  { symbol: "COIN", name: "Coinbase", sector: "Fin", price: 218.5, change: 2.4, volume: "12.8M", cap: "55B" },
  { symbol: "JPM", name: "JPMorgan Chase", sector: "Fin", price: 198.45, change: 0.31, volume: "9.1M", cap: "566B" },
]

const SECTORS = ["All", "Tech", "Semis", "Fin", "Auto", "Retail", "Energy", "Media"]

export default function MarketsPage() {
  const [rows, setRows] = useState(INITIAL)
  const [q, setQ] = useState("")
  const [sector, setSector] = useState("All")

  useEffect(() => {
    const t = setInterval(() => {
      setRows((arr) =>
        arr.map((r) => {
          const drift = (Math.random() - 0.5) * 0.006
          return { ...r, price: +(r.price * (1 + drift)).toFixed(2), change: +(r.change + drift * 100).toFixed(2) }
        })
      )
    }, 2400)
    return () => clearInterval(t)
  }, [])

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (sector === "All" || r.sector === sector) &&
          (q === "" || r.symbol.toLowerCase().includes(q.toLowerCase()) || r.name.toLowerCase().includes(q.toLowerCase()))
      ),
    [rows, q, sector]
  )

  const gainers = [...rows].sort((a, b) => b.change - a.change).slice(0, 3)
  const losers = [...rows].sort((a, b) => a.change - b.change).slice(0, 3)

  return (
    <DashboardShell title="Markets" subtitle={`${rows.length} symbols · live ticks · 15-min delayed`}>
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[  
          { title: "Top Gainers", data: gainers, icon: TrendingUp, color: "text-bull" },
          { title: "Top Losers", data: losers, icon: TrendingDown, color: "text-bear" },
        ].map((g) => (
          <div key={g.title} className="bg-[#161d27] rounded-2xl border border-[#232c3a] p-5">
            <div className="flex items-center gap-2 mb-4">
              <g.icon size={15} className={g.color} />
              <h3 className="text-sm font-semibold tracking-tight">{g.title}</h3>
            </div>
            <div className="space-y-2">
              {g.data.map((r) => {
                const up = r.change >= 0
                return (
                  <div key={r.symbol} className="flex items-center justify-between p-3 rounded-xl bg-[#1c2532] border border-[#232c3a]">
                    <div>
                      <div className="text-sm font-semibold">{r.symbol}</div>
                      <div className="text-[11px] text-slate-500 truncate">{r.name}</div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className="text-sm font-semibold">${r.price.toFixed(2)}</div>
                      <div className={`text-[11px] ${up ? "text-bull" : "text-bear"}`}>{up ? "+" : ""}{r.change.toFixed(2)}%</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="bg-[#161d27] rounded-2xl border border-[#232c3a] p-5">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search symbol or name…"
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-[#1c2532] border border-[#232c3a] text-sm placeholder:text-slate-600 focus:outline-none focus:border-amber-accent focus:ring-2 focus:ring-amber/30 transition-all"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-thin">
            {SECTORS.map((s) => (
              <button
                key={s}
                onClick={() => setSector(s)}
                className={`px-3 h-10 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                  s === sector
                    ? "bg-amber/15 border-amber/30 text-amber-accent"
                    : "bg-[#1c2532] border-[#232c3a] text-slate-400 hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-[#232c3a]">
                {["Symbol", "Sector", "Price", "Change", "Volume", "Mkt Cap"].map((h, i) => (
                  <th key={h} className={`py-3 px-3 font-medium ${i > 1 ? "text-right" : "text-left"}`}>
                    <span className="inline-flex items-center gap-1">{h}{i > 1 && <ArrowUpDown size={10} />}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const up = r.change >= 0
                return (
                  <tr key={r.symbol} className="border-b border-[#232c3a] hover:bg-white/[0.02] transition-colors cursor-pointer">
                    <td className="py-3 px-3"><div className="font-semibold">{r.symbol}</div><div className="text-[11px] text-slate-500 truncate">{r.name}</div></td>
                    <td className="py-3 px-3"><span className="text-[11px] px-2 py-0.5 rounded-md bg-[#1c2532] border border-[#232c3a] text-slate-400">{r.sector}</span></td>
                    <td className="py-3 px-3 text-right tabular-nums font-medium">${r.price.toFixed(2)}</td>
                    <td className={`py-3 px-3 text-right tabular-nums ${up ? "text-bull" : "text-bear"}`}>{up ? "+" : ""}{r.change.toFixed(2)}%</td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-400">{r.volume}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-400">${r.cap}</td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-slate-500 text-sm">No symbols match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  )
}
```

---

### File: `frontend/src/pages/News.tsx`
```typescript
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Newspaper, ChevronDown } from 'lucide-react'
import api from '@/lib/api'
import { DashboardShell } from '@/components/layout/DashboardShell'

interface NewsItem {
  id: number
  symbol: string
  headline: string
  source: string
  url: string
  published_at: string
  sentiment_score?: number | null
}

const symbols = ['AAPL', 'TSLA', 'NVDA', 'MSFT']

function sentimentTone(score?: number | null) {
  if (score === null || score === undefined) return 'text-slate-400 bg-slate-800/60 border-slate-700'
  if (score >= 0.3) return 'text-bull bg-bull/10 border-bull/20'
  if (score <= -0.3) return 'text-bear bg-bear/10 border-bear/20'
  return 'text-amber-accent bg-amber/10 border-amber/20'
}

export default function NewsPage() {
  const [symbol, setSymbol] = useState('AAPL')

  const { data, isLoading } = useQuery<NewsItem[]>({
    queryKey: ['news', symbol],
    queryFn: () => api.get(`/news/${symbol}`).then((r) => r.data),
  })

  return (
    <DashboardShell 
      title="News Feed" 
      subtitle="Recent headlines and sentiment for selected symbols."
      actions={
        <div className="relative inline-block">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="appearance-none bg-[#161d27] border border-[#232c3a] text-slate-100 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium focus:outline-none focus:border-[#f5b454] focus:ring-2 focus:ring-amber/30 transition-all cursor-pointer shadow-lg shadow-black/20"
          >
            {symbols.map((s) => (
              <option key={s} className="bg-[#1c2532] text-slate-100" value={s}>
                {s}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
      }
    >
      <div className="bg-[#161d27] rounded-2xl border border-[#232c3a] p-6">
        {isLoading ? (
          <div className="space-y-4">
            <div className="shimmer h-24 rounded-xl w-full" />
            <div className="shimmer h-24 rounded-xl w-full" />
            <div className="shimmer h-24 rounded-xl w-full" />
          </div>
        ) : data && data.length > 0 ? (
          <div className="space-y-4">
            {data.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="group block rounded-2xl border border-[#232c3a] bg-[#1c2532] p-5 hover:border-amber/40 transition-all"
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber/10 flex items-center justify-center">
                      <Newspaper size={14} className="text-amber-accent" />
                    </div>
                    <span className="text-xs text-slate-400 font-medium">{item.source}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border uppercase tracking-wider ${sentimentTone(item.sentiment_score)}`}>
                    {item.sentiment_score === null || item.sentiment_score === undefined
                      ? 'N/A'
                      : item.sentiment_score.toFixed(2)}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-slate-100 leading-relaxed group-hover:text-amber-accent transition-colors">{item.headline}</h3>
                <p className="text-[11px] text-slate-500 mt-3 tabular-nums">
                  {new Date(item.published_at).toLocaleString()}
                </p>
              </a>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#1c2532] border border-[#232c3a] flex items-center justify-center mb-4">
              <Newspaper size={24} className="text-slate-700" />
            </div>
            <p className="text-sm text-slate-500">
              No news yet for {symbol}. Run a query to populate news via the agent pipeline.
            </p>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
```

---

### File: `frontend/src/pages/Positions.tsx`
```typescript
import { useState } from 'react'
import { PlusCircle, TrendingUp, TrendingDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { AddPositionForm } from '@/components/positions/AddPositionForm'
import { HoldingsCard } from '@/components/positions/HoldingsCard'
import api from '@/lib/api'
import { DashboardShell } from '@/components/layout/DashboardShell'

interface Position {
  id: number
  symbol: string
  quantity: number
  average_price: number
}

const SECTOR_COLORS: Record<string, string> = {
  Tech: 'bg-blue-500/20 text-blue-400',
  Semis: 'bg-purple-500/20 text-purple-400',
  Fin: 'bg-emerald-500/20 text-emerald-400',
  Auto: 'bg-rose-500/20 text-rose-400',
  Retail: 'bg-amber-500/20 text-amber-400',
  Energy: 'bg-orange-500/20 text-orange-400',
  Media: 'bg-pink-500/20 text-pink-400',
  Healthcare: 'bg-teal-500/20 text-teal-400',
}

const MOCK_SECTORS: Record<string, string> = {
  AAPL: 'Tech', NVDA: 'Semis', MSFT: 'Tech', TSLA: 'Auto',
  GOOGL: 'Tech', AMZN: 'Retail', META: 'Tech', AMD: 'Semis',
  COIN: 'Fin', JPM: 'Fin', XOM: 'Energy', NFLX: 'Media',
}

export default function PositionsPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const { data: positions, isLoading } = useQuery<Position[]>({
    queryKey: ['positions'],
    queryFn: () => api.get('/positions').then((r) => r.data),
  })

  const sortedPositions = useMemo(() => {
    return [...(positions || [])].sort((a, b) => {
      const aVal = a.quantity * (a as any).current_price || 0
      const bVal = b.quantity * (b as any).current_price || 0
      return bVal - aVal
    })
  }, [positions])

  return (
    <DashboardShell
      title="Portfolio"
      subtitle="Live positions with real-time P&L and sector allocation."
      actions={
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#f5b454] hover:bg-[#f7c372] text-[#1a1207] text-sm font-medium transition-all active:scale-[0.98] shadow-lg shadow-[#f5b454]/30 cursor-pointer"
        >
          <PlusCircle size={18} />
          Add Position
        </button>
      }
    >
      <HoldingsCard positions={positions || []} onAdd={() => setModalOpen(true)} />

      <div className="mt-6 bg-[#161d27] rounded-2xl border border-[#232c3a] p-6">
        <h3 className="text-base font-semibold tracking-tight mb-4">Sector Allocation</h3>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="shimmer h-8 rounded-lg w-full" />
            ))}
          </div>
        ) : sortedPositions.length > 0 ? (
          <div className="space-y-3">
            {sortedPositions.map((pos) => {
              const sector = MOCK_SECTORS[pos.symbol] || 'Other'
              const color = SECTOR_COLORS[sector] || 'bg-slate-500/20 text-slate-400'
              const unrealizedPL = (pos as any).unrealized_pl || 0
              const up = unrealizedPL >= 0
              return (
                <div key={pos.id} className="flex items-center justify-between p-3 rounded-xl bg-[#1c2532] border border-[#232c3a]">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>{sector}</span>
                    <span className="font-semibold">{pos.symbol}</span>
                    <span className="text-slate-500 text-sm">{pos.quantity} shares</span>
                  </div>
                  <div className={`text-sm font-semibold ${up ? 'text-bull' : 'text-bear'}`}>
                    {up ? <TrendingUp size={14} className="inline mr-1" /> : <TrendingDown size={14} className="inline mr-1" />}
                    {unrealizedPL >= 0 ? '+' : ''}${unrealizedPL.toFixed(2)}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 text-sm">
            No positions yet. Add your first position to see sector allocation.
          </div>
        )}
      </div>

      <AddPositionForm open={modalOpen} onClose={() => setModalOpen(false)} />
    </DashboardShell>
  )
}
```

---

### File: `frontend/src/components/query/NLQueryBar.tsx`
```typescript
import { useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import { AICopilot } from './AICopilot'

interface NLQueryBarProps {
  onRun?: (runId?: string) => void
}

export function NLQueryBar({ onRun }: NLQueryBarProps) {
  const [symbol, setSymbol] = useState('AAPL')
  const [query, setQuery] = useState('')

  return (
    <AICopilot onRun={(runId) => {
      console.log('DAG run started:', runId)
      onRun?.(runId)
    }} />
  )
}
```

---

### File: `frontend/src/components/query/AnswerPanel.tsx`
```typescript
import { CitationGuard } from '@/lib/citation-guard'

interface AnswerPanelProps {
  answer: string
  loading: boolean
}

export function AnswerPanel({ answer, loading }: AnswerPanelProps) {
  if (loading) {
    return (
      <div className="rounded-xl bg-[#121821] border border-[#232c3a] border-t-2 border-t-amber/30 p-4">
        <div className="space-y-2.5">
          <div className="shimmer h-3 rounded w-[88%]" />
          <div className="shimmer h-3 rounded w-[72%]" />
          <div className="shimmer h-3 rounded w-[60%]" />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-[#121821] border border-[#232c3a] border-t-2 border-t-amber-500 p-4">
      <CitationGuard text={answer} />
    </div>
  )
}
```

---

### File: `frontend/src/components/dag/AgentNode.tsx`
```typescript
import { useEffect, useState } from 'react'

interface AgentNodeProps {
  name: string
  status: 'idle' | 'running' | 'done' | 'error' | 'skipped'
  latency?: number
  tokens?: number
  partialOutput?: string
}

export function AgentNode({ name, status, latency, tokens, partialOutput }: AgentNodeProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (status === 'running') {
      const interval = setInterval(() => {
        setProgress((p) => (p >= 90 ? 90 : p + 1))
      }, 50)
      return () => clearInterval(interval)
    } else if (status === 'done' || status === 'error') {
      setProgress(100)
    } else {
      setProgress(0)
    }
  }, [status])

  const statusColors = {
    idle: 'bg-slate-700 text-slate-400 border-slate-600',
    running: 'bg-amber-500/20 text-amber-accent border-amber-500/50 animate-pulse',
    done: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
    error: 'bg-rose-500/20 text-rose-400 border-rose-500/50',
    skipped: 'bg-slate-700/50 text-slate-500 border-slate-600/50',
  }

  return (
    <div className={`p-4 rounded-xl border ${statusColors[status]} min-w-[200px]`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold capitalize">{name}</span>
        <div className={`w-2 h-2 rounded-full ${
          status === 'running' ? 'bg-amber-accent animate-pulse' :
          status === 'done' ? 'bg-emerald-400' :
          status === 'error' ? 'bg-rose-400' : 'bg-slate-600'
        }`} />
      </div>
      {status === 'running' && (
        <div className="w-full bg-slate-700 rounded-full h-1.5 mb-2">
          <div className="bg-amber-accent h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="text-xs space-y-1">
        {latency && <div>Latency: {latency}ms</div>}
        {tokens && <div>Tokens: {tokens}</div>}
        {partialOutput && <div className="text-slate-400 truncate">{partialOutput.slice(0, 50)}...</div>}
      </div>
    </div>
  )
}
```

---

### File: `frontend/src/components/dag/DAGVisualizer.tsx`
```typescript
import { useEffect, useState } from 'react'
import { Play, RefreshCw, AlertCircle } from 'lucide-react'
import { useWsStore } from '@/store/wsStore'
import { AgentNode } from './AgentNode'

interface DAGVisualizerProps {
  runToken?: number
  currentRunId?: string | null
}

const DAG_NODES = [
  { id: 'MarketData', label: 'Market Data', x: 50, y: 50 },
  { id: 'News', label: 'News Analysis', x: 250, y: 20 },
  { id: 'Forecast', label: 'Forecast', x: 250, y: 80 },
  { id: 'Risk', label: 'Risk Assessment', x: 450, y: 50 },
  { id: 'Alert', label: 'Alert Synthesis', x: 650, y: 50 },
]

const CONNECTIONS = [
  { from: 'MarketData', to: 'News' },
  { from: 'MarketData', to: 'Forecast' },
  { from: 'News', to: 'Risk' },
  { from: 'Forecast', to: 'Risk' },
  { from: 'Risk', to: 'Alert' },
]

export function DAGVisualizer({ runToken, currentRunId }: DAGVisualizerProps) {
  const dagEvents = useWsStore((s) => s.dagEvents)
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [nodeStates, setNodeStates] = useState<Record<string, any>>({})

  useEffect(() => {
    // Filter events for current run
    const currentEvents = currentRunId ? dagEvents.filter((e) => e.run_id === currentRunId) : dagEvents.slice(-10)

    const newStates: Record<string, any> = {}
    let hasRunning = false
    let hasError = false
    let allDone = true

    DAG_NODES.forEach((node) => {
      const events = currentEvents.filter((e) => e.node === node.id)
      const latest = events[events.length - 1]

      if (latest) {
        newStates[node.id] = {
          status: latest.status,
          latency: latest.latency_ms,
          tokens: latest.tokens,
          partialOutput: latest.partial_output,
        }

        if (latest.status === 'running') hasRunning = true
        if (latest.status === 'error') hasError = true
        if (latest.status !== 'done' && latest.status !== 'skipped') allDone = false
      } else {
        newStates[node.id] = { status: 'idle' as const }
        allDone = false
      }
    })

    setNodeStates(newStates)

    if (hasRunning) setRunStatus('running')
    else if (hasError) setRunStatus('error')
    else if (allDone && Object.keys(newStates).length > 0) setRunStatus('done')
    else setRunStatus('idle')
  }, [dagEvents, currentRunId, runToken])

  return (
    <div className="bg-[#161d27] rounded-2xl border border-[#232c3a] p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber/15 border border-amber/30 flex items-center justify-center">
            <RefreshCw size={14} className="text-amber-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight">DAG Execution</h3>
            <p className="text-[10px] text-slate-500 uppercase">5-Agent Pipeline</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-medium ${
          runStatus === 'running' ? 'bg-amber/15 text-amber-accent border border-amber/30' :
          runStatus === 'done' ? 'bg-emerald/15 text-emerald-400 border border-emerald/50' :
          runStatus === 'error' ? 'bg-rose/15 text-rose-400 border border-rose/50' :
          'bg-slate-700/50 text-slate-400 border border-slate-600'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${
            runStatus === 'running' ? 'bg-amber-accent animate-pulse' :
            runStatus === 'done' ? 'bg-emerald-400' :
            runStatus === 'error' ? 'bg-rose-400' : 'bg-slate-600'
          }`} />
          {runStatus === 'running' && 'Running'}
          {runStatus === 'done' && 'Complete'}
          {runStatus === 'error' && 'Error'}
          {runStatus === 'idle' && 'Idle'}
        </div>
      </div>

      <div className="relative bg-[#0f1419] rounded-xl p-8 overflow-hidden">
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#f5b454" fillOpacity="0.3" />
            </marker>
          </defs>
          {CONNECTIONS.map((conn, i) => {
            const fromNode = DAG_NODES.find((n) => n.id === conn.from)
            const toNode = DAG_NODES.find((n) => n.id === conn.to)
            if (!fromNode || !toNode) return null

            const fromX = 100 + fromNode.x
            const fromY = 80 + fromNode.y
            const toX = 100 + toNode.x
            const toY = 80 + toNode.y

            const fromState = nodeStates[conn.from]
            const toState = nodeStates[conn.to]

            let strokeColor = '#232c3a'
            let strokeWidth = 1

            if (fromState?.status === 'done' && toState?.status === 'running') strokeColor = '#f5b454'
            if (fromState?.status === 'done' && toState?.status === 'done') strokeColor = '#10b981'
            if (fromState?.status === 'error' || toState?.status === 'error') strokeColor = '#ef4444'

            return (
              <g key={i}>
                <line
                  x1={fromX}
                  y1={fromY + 20}
                  x2={toX}
                  y2={toY + 20}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  markerEnd={strokeColor !== '#232c3a' ? 'url(#arrowhead)' : undefined}
                  className="transition-all duration-300"
                />
              </g>
            )
          })}
        </svg>

        {DAG_NODES.map((node) => (
          <div
            key={node.id}
            className="absolute"
            style={{ left: 100 + node.x, top: 80 + node.y }}
          >
            <AgentNode
              name={node.label}
              status={nodeStates[node.id]?.status || 'idle'}
              latency={nodeStates[node.id]?.latency}
              tokens={nodeStates[node.id]?.tokens}
              partialOutput={nodeStates[node.id]?.partialOutput}
            />
          </div>
        ))}
      </div>

      {runStatus === 'error' && (
        <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-rose-400 text-sm">
          <AlertCircle size={16} />
          One or more nodes encountered an error. Check the individual node status.
        </div>
      )}
    </div>
  )
}
```

---

### File: `frontend/src/lib/api.ts`
```typescript
import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      delete api.defaults.headers.common['Authorization']
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
```

---

### File: `frontend/src/lib/ws.ts`
```typescript
import { useAuthStore } from './store/authStore'
import { useWsStore } from './store/wsStore'

let ws: WebSocket | null = null

export function connectWS() {
  const token = localStorage.getItem('token')
  if (!token) return

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close()
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  ws = new WebSocket(`${protocol}//${host}/ws?token=${token}`)

  ws.onopen = () => {
    useWsStore.getState().setConnected(true)
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      useWsStore.getState().handleEvent(data)
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e)
    }
  }

  ws.onclose = () => {
    useWsStore.getState().setConnected(false)
    setTimeout(connectWS, 3000)
  }

  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
    useWsStore.getState().setConnected(false)
  }
}

export function disconnectWS() {
  if (ws) {
    ws.close()
    ws = null
  }
}
```

---

### File: `frontend/src/lib/queries/forecast.ts`
```typescript
import { useQuery } from '@tanstack/react-query'
import api from './api'

export function useForecast(symbol: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['forecast', symbol],
    queryFn: () => api.get(`/forecast/${symbol}`).then((r) => r.data),
    enabled: enabled && !!symbol,
    staleTime: 5 * 60 * 1000,
  })
}
```

---

### File: `frontend/src/lib/queries/news.ts`
```typescript
import { useQuery } from '@tanstack/react-query'
import api from './api'

export function useNews(symbol: string) {
  return useQuery({
    queryKey: ['news', symbol],
    queryFn: () => api.get(`/news/${symbol}`).then((r) => r.data),
    enabled: !!symbol,
    staleTime: 2 * 60 * 1000,
  })
}
```

---

### File: `frontend/src/lib/citation-guard.ts`
```typescript
import { useMemo } from 'react'

const NUMERIC_PATTERN = /\$?\d+(?:\.\d+)?%?(?!\s*\[\d+\])/g

const FALSE_POSITIVE_PATTERNS = [
  /\d{4}/,
]

function isFalsePositive(match: string): boolean {
  return FALSE_POSITIVE_PATTERNS.some(pattern => pattern.test(match))
}

export function findUncitedNumerics(text: string): string[] {
  const matches = text.match(NUMERIC_PATTERN) || []
  return matches.filter(m => {
    const num = parseFloat(m.replace(/\$/g, '').replace(/%/g, ''))
    return !isNaN(num) && num < 10000 && !isFalsePositive(m)
  })
}

export function sanitizeText(text: string): string {
  const uncited = findUncitedNumerics(text)
  if (uncited.length === 0) return text

  return text.replace(NUMERIC_PATTERN, (match) => {
    const num = parseFloat(match.replace(/\$/g, '').replace(/%/g, ''))
    if (isNaN(num) || num >= 10000 || isFalsePositive(match)) {
      return match
    }
    return `[REDACTED: uncited numeric]`
  })
}

export function CitationChip({ children, source }: { children: React.ReactNode; source?: string }) {
  return (
    <sup className="text-[10px] font-bold text-amber-accent bg-amber/20 rounded px-1 cursor-help" title={source || 'Citation'}>
      {children}
    </sup>
  )
}

export function CitationGuard({ text }: { text: string }) {
  const safeText = useMemo(() => sanitizeText(text), [text])

  return <span className="text-slate-200">{safeText}</span>
}

export function CitationList({ text }: { text: string }) {
  const citations = useMemo(() => {
    const matches = text.match(/\[(\d+)\]/g) || []
    return [...new Set(matches)].map(c => parseInt(c.slice(1, -1)))
  }, [text])

  if (citations.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 pt-2 border-t border-[#232c3a] mt-2">
      {citations.map(c => (
        <a
          key={c}
          className="text-[11px] text-amber-accent hover:text-amber-400 flex items-center gap-1 cursor-pointer"
        >
          [{c}]
        </a>
      ))}
    </div>
  )
}
```

---

### File: `frontend/src/lib/utils.ts`
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

### File: `frontend/src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-[#0f1419] text-slate-100;
  }
}

@layer components {
  .btn-primary {
    @apply px-4 py-2 rounded-lg bg-[#f5b454] hover:bg-[#f7c372] text-[#1a1207] font-medium transition-all active:scale-[0.98];
  }

  .btn-secondary {
    @apply px-4 py-2 rounded-lg border border-[#232c3a] text-slate-400 hover:text-white hover:border-amber/30 transition-colors;
  }
}

@layer utilities {
  .scrollbar-thin::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: #232c3a;
    border-radius: 3px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: #333;
  }
}

@keyframes shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
}

.shimmer {
  background: linear-gradient(90deg, #161d27 25%, #232c3a 50%, #161d27 75%);
  background-size: 200px 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes flash-up {
  0%, 100% { background-color: transparent; }
  50% { background-color: rgba(16, 185, 129, 0.2); }
}

@keyframes flash-down {
  0%, 100% { background-color: transparent; }
  50% { background-color: rgba(239, 68, 68, 0.2); }
}

.flash-up {
  animation: flash-up 0.6s ease-out;
}

.flash-down {
  animation: flash-down 0.6s ease-out;
}

button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid #f5b454;
  outline-offset: 2px;
}
```

---

### File: `frontend/src/index.tsx`
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

---

### File: `frontend/vite.config.ts`
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || 'http://localhost:8000'),
  },
})
```

---

### File: `frontend/package.json`
```json
{
  "name": "finsight-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.0.0",
    "axios": "^1.6.0",
    "lucide-react": "^0.300.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "zustand": "^4.4.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.40",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "eslint": "^8.55.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.3.6",
    "typescript": "^5.2.2",
    "vite": "^5.0.0"
  }
}
```

---

### File: `frontend/tailwind.config.ts`
```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'amber-accent': '#f5b454',
        'bull': '#10b981',
        'bear': '#ef4444',
        'border-default': '#232c3a',
        'border-amber': '#f5b454',
      },
      backgroundImage: {
        'gradient-br': 'linear-gradient(to bottom right, #f5b454, #f7c372)',
      },
    },
  },
  plugins: [],
} satisfies Config
```

---

### File: `frontend/.env.example`
```bash
VITE_API_URL=http://localhost:8000
```

---

### File: `frontend/public/index.html`
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FinSight AI - Financial Intelligence Platform</title>
    <meta name="description" content="Real-time financial insights and AI-powered market analysis" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## Summary

This file covers all frontend implementation:
- App root with routing, authentication, and WebSocket integration
- Login page with demo credentials auto-fill
- Dashboard, Markets, News, Positions, Watchlist, Audit, Settings pages
- ProtectedRoute for authentication guards
- DashboardShell, Sidebar, Topbar, Navbar layout components
- HoldingsCard with live P&L and flash animations
- AddPositionModal and AddPositionForm
- WatchlistCard with real-time price updates
- CandleChart with SVG rendering
- AICopilot with natural language query interface
- AgentNode and DAGVisualizer for pipeline monitoring
- AnswerPanel with citation support
- NLQueryBar for quick queries
- API client with auth token management
- WebSocket connection with auto-reconnect
- Query hooks for forecast and news
- CitationGuard for numeric claim validation
- State management with Zustand (auth, WebSocket)
- Utility functions and Tailwind configuration
- TypeScript type definitions and Vite configuration