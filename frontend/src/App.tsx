import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import DashboardLayout from './components/layout/DashboardLayout'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/Login'
import { useAuthStore } from './store/authStore'
import { connectWS } from './lib/ws'

function OverviewPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Market Overview</h1>
        <p className="text-slate-400">Welcome back. Here's what's happening today.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {['AAPL', 'TSLA', 'NVDA', 'MSFT'].map((symbol, i) => {
          const prices = [189.30, 245.67, 875.20, 421.50]
          const changes = ['+1.2%', '-0.8%', '+2.4%', '+0.5%']
          const positive = [true, false, true, true]
          return (
            <div key={symbol} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500/40 transition-all duration-300 group cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-slate-200 text-sm tracking-wide">{symbol}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${positive[i] ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10'}`}>
                  {changes[i]}
                </span>
              </div>
              <div className="text-2xl font-bold text-white tabular-nums">${prices[i].toFixed(2)}</div>
              <div className="mt-3 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${positive[i] ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${60 + i * 8}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function App() {
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (token) connectWS()
  }, [token])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/watchlist" element={<div className="text-white">Watchlist — coming soon</div>} />
                <Route path="/positions" element={<div className="text-white">Positions — coming soon</div>} />
                <Route path="/news" element={<div className="text-white">News — coming soon</div>} />
                <Route path="/audit" element={<div className="text-white">Audit — coming soon</div>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
