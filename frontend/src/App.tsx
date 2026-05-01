import { Routes, Route } from 'react-router-dom'
import DashboardLayout from './components/layout/DashboardLayout'

function Overview() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight text-white">Market Overview</h2>
        <p className="text-slate-400">Welcome back to FinSight AI. Here's what's happening today.</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {['BTC/USD', 'AAPL', 'TSLA', 'NVDA'].map((symbol) => (
          <div key={symbol} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm hover:border-blue-500/50 transition-colors group">
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-slate-200">{symbol}</span>
              <span className="text-emerald-400 text-sm font-medium">+2.4%</span>
            </div>
            <div className="text-2xl font-bold text-white">$98,432.12</div>
            <div className="h-1 w-full bg-slate-800 mt-4 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function App() {
  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/watchlist" element={<div>Watchlist Page</div>} />
        <Route path="/positions" element={<div>Positions Page</div>} />
        <Route path="/news" element={<div>News Page</div>} />
        <Route path="/audit" element={<div>Audit Page</div>} />
        <Route path="/settings" element={<div>Settings Page</div>} />
      </Routes>
    </DashboardLayout>
  )
}

export default App
