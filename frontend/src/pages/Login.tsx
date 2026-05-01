import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { connectWS } from '@/lib/ws'
import api from '@/lib/api'
import { Zap, TrendingUp, Shield, Activity } from 'lucide-react'
import { useState } from 'react'

const features = [
  { icon: Activity, label: "Real-Time Data",    desc: "Live market ticks every 15s via WebSocket" },
  { icon: TrendingUp, label: "AI Forecasting",  desc: "Prophet + Gemini 7-day price projections" },
  { icon: Shield,   label: "Risk Analysis",     desc: "Multi-node DAG risk scoring engine" },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => { emailRef.current?.focus() }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('username', email)
      params.append('password', password)
      const { data } = await api.post('/auth/login', params)
      const me = await api.get('/users/me', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      })
      setAuth(data.access_token, me.data)
      connectWS()
      navigate('/')
    } catch {
      setError('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: "100dvh",
      background: "var(--bg-base)",
      display: "flex",
      fontFamily: "var(--font-sans)",
    }}>
      {/* Left panel — branding */}
      <div style={{
        flex: 1,
        padding: "48px 56px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        borderRight: "1px solid var(--border)",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Ambient glow */}
        <div style={{
          position: "absolute", top: -100, left: -100,
          width: 500, height: 500,
          background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 65%)",
          borderRadius: "50%", filter: "blur(60px)", pointerEvents: "none",
        }} />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #6366F1, #4F46E5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 20px rgba(99,102,241,0.45)",
          }}>
            <Zap size={18} color="#fff" />
          </div>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em" }}>
            <span className="glow-text-accent">Fin</span>
            <span style={{ color: "var(--text-primary)" }}>Sight</span>
          </span>
        </div>

        {/* Main copy */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#818CF8", marginBottom: 16 }}>
            AI-POWERED TRADING INTELLIGENCE
          </p>
          <h2 style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.04em", color: "var(--text-primary)", marginBottom: 20 }}>
            Real-time insights<br />
            <span className="glow-text-accent">for every trade.</span>
          </h2>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.65, maxWidth: 380, marginBottom: 40 }}>
            5-node AI pipeline that analyses market data, news sentiment, and price forecasts — all streaming live to your dashboard.
          </p>

          {/* Features */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {features.map((f) => (
              <div key={f.label} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: "var(--accent-dim)",
                  border: "1px solid rgba(99,102,241,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <f.icon size={14} color="#818CF8" />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{f.label}</p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
          ⚠ Educational use only · Not financial advice · Nebula9.ai Assessment
        </p>
      </div>

      {/* Right panel — form */}
      <div style={{
        width: 440,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "48px 48px",
      }}>
        <div style={{ marginBottom: 40 }}>
          <h3 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 6 }}>
            Sign in
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Access your AI-powered dashboard
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label htmlFor="login-email" style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
              Email address
            </label>
            <input
              id="login-email"
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="demo@finsight.ai"
              required
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                fontSize: 14,
                outline: "none",
                transition: "border-color 150ms",
                fontFamily: "inherit",
              }}
              onFocus={(e) => { e.target.style.borderColor = "var(--accent)" }}
              onBlur={(e)  => { e.target.style.borderColor = "var(--border)" }}
            />
          </div>

          <div>
            <label htmlFor="login-password" style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                fontSize: 14,
                outline: "none",
                transition: "border-color 150ms",
                fontFamily: "inherit",
              }}
              onFocus={(e) => { e.target.style.borderColor = "var(--accent)" }}
              onBlur={(e)  => { e.target.style.borderColor = "var(--border)" }}
            />
          </div>

          {error && (
            <div style={{
              padding: "10px 14px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 8,
              fontSize: 12,
              color: "#FCA5A5",
            }}>
              {error}
            </div>
          )}

          <button
            id="login-btn"
            type="submit"
            disabled={loading}
            className="btn-accent"
            style={{ width: "100%", padding: "11px 20px", fontSize: 14, marginTop: 4, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <svg style={{ animation: "spin 1s linear infinite", width: 14, height: 14 }} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
                Signing in...
              </span>
            ) : "Sign in →"}
          </button>

          {/* Demo hint */}
          <div style={{
            marginTop: 8,
            padding: "10px 14px",
            background: "var(--accent-dim)",
            border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: 8,
            fontSize: 12,
          }}>
            <span style={{ color: "var(--text-secondary)" }}>Demo: </span>
            <button
              type="button"
              onClick={() => { setEmail("demo@finsight.ai"); setPassword("Demo@12345") }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#818CF8", fontWeight: 500, fontSize: 12 }}
            >
              Click to fill credentials →
            </button>
          </div>
        </form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  )
}
