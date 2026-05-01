import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { connectWS } from '@/lib/ws'
import api from '@/lib/api'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('username', email)
      params.append('password', password)
      const { data } = await api.post('/auth/login', params)
      // Fetch user info
      const me = await api.get('/users/me', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      })
      setAuth(data.access_token, me.data)
      connectWS()
      navigate('/')
    } catch {
      setError('Invalid credentials. Try demo@finsight.ai / Demo@12345')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              FinSight AI
            </span>
          </div>
          <p className="text-slate-400 text-sm">Real-Time Financial Intelligence</p>
        </div>

        <Card className="bg-slate-900/80 backdrop-blur-xl border-slate-800 shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-white">Sign in</CardTitle>
            <CardDescription className="text-slate-400">
              Access your AI-powered dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-300">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="demo@finsight.ai"
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-slate-300">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {error && (
                <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-lg text-rose-400 text-sm">
                  {error}
                </div>
              )}

              <Button
                id="login-btn"
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium h-11 transition-all shadow-lg shadow-blue-600/20"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Authenticating...
                  </span>
                ) : 'Sign in'}
              </Button>

              <div className="pt-2 border-t border-slate-800">
                <p className="text-xs text-center text-slate-500">
                  Demo: <span className="text-slate-400 font-mono">demo@finsight.ai</span> / <span className="text-slate-400 font-mono">Demo@12345</span>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-slate-600">
          ⚠ Educational use only. Not financial advice. — Nebula9.ai Assessment
        </p>
      </div>
    </div>
  )
}
