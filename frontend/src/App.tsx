import { useState, useEffect } from 'react'

function App() {
  const [status, setStatus] = useState<string>('Loading...')

  useEffect(() => {
    fetch('http://localhost:8000/healthz')
      .then(res => res.json())
      .then(data => setStatus(data.status))
      .catch(() => setStatus('Error connecting to backend'))
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
        FinSight AI
      </h1>
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl">
        <p className="text-lg">
          Backend Status: <span className={status === 'ok' ? 'text-emerald-400' : 'text-rose-400'}>{status}</span>
        </p>
      </div>
      <p className="mt-8 text-slate-500 text-sm italic">
        Real-time Financial Insights Dashboard - Nebula9.ai Assessment
      </p>
    </div>
  )
}

export default App
