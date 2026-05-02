import { useState } from "react"
import { User, Bell, Shield, Database, Sparkles } from "lucide-react"
import { DashboardShell } from "@/components/layout/DashboardShell"
import { useAuthStore } from "@/store/authStore"

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={[
        "relative w-10 h-6 rounded-full transition-colors cursor-pointer",
        on ? "bg-[#f5b454]" : "bg-[#232c3a]",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform",
          on ? "translate-x-[18px]" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  )
}

export default function SettingsPage() {
  const [alerts, setAlerts] = useState(true)
  const [push, setPush] = useState(false)
  const [strictCite, setStrictCite] = useState(true)
  const [forecast7d, setForecast7d] = useState(true)
  
  const { user } = useAuthStore()
  const email = user?.email ?? "utkarsh@finsight.ai"
  const displayName = user?.email ? user.email.split("@")[0] : "Utkarsh W."
  const initials = user?.email ? user.email[0].toUpperCase() : "UW"

  return (
    <DashboardShell title="Settings" subtitle="Personal preferences, alerts and AI behavior">
      <div className="text-center py-12">
        <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
        <p className="text-slate-500">Settings page is under development.</p>
      </div>
        {/* Sidebar nav */}
        <aside className="space-y-1">
          {[
            { label: "Profile", icon: User, active: true },
            { label: "Notifications", icon: Bell },
            { label: "AI Behavior", icon: Sparkles },
            { label: "Data Sources", icon: Database },
            { label: "Security", icon: Shield },
          ].map((s) => (
            <button
              key={s.label}
              className={[
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer",
                s.active
                  ? "bg-amber/10 text-amber-accent font-medium"
                  : "text-slate-400 hover:bg-white/5 hover:text-white",
              ].join(" ")}
            >
              <s.icon size={15} />
              {s.label}
            </button>
          ))}
        </aside>

        <div className="lg:col-span-2 space-y-6">
          {/* Profile */}
          <div className="bg-[#161d27] rounded-2xl border border-[#232c3a] p-6">
            <div className="flex items-center gap-2 mb-5">
              <User size={15} className="text-amber-accent" />
              <h3 className="text-base font-semibold tracking-tight">Profile</h3>
            </div>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#f5b454] to-[#a86d1e] flex items-center justify-center text-xl font-semibold text-[#1a1207]">
                {initials}
              </div>
              <div>
                <div className="text-sm font-semibold">{displayName}</div>
                <div className="text-xs text-slate-500">{email} · Free tier</div>
                <button className="mt-2 text-[11px] text-amber-accent hover:underline cursor-pointer">
                  Upgrade to Pro
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: "Display name", value: displayName },
                { label: "Email", value: email },
                { label: "Default currency", value: "USD" },
                { label: "Timezone", value: "Asia/Kolkata (IST)" },
              ].map((f) => (
                <div key={f.label}>
                  <label className="text-xs font-medium text-slate-400">{f.label}</label>
                  <input
                    defaultValue={f.value}
                    className="mt-2 w-full px-4 py-2.5 bg-[#1c2532] border border-[#232c3a] rounded-xl text-sm focus:outline-none focus:border-[#f5b454] focus:ring-2 focus:ring-amber/30 transition-all"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-[#161d27] rounded-2xl border border-[#232c3a] p-6">
            <div className="flex items-center gap-2 mb-5">
              <Bell size={15} className="text-amber-accent" />
              <h3 className="text-base font-semibold tracking-tight">Notifications</h3>
            </div>
            <div className="space-y-4">
              {[
                { label: "Price alerts", sub: "Email when a watchlist target is hit", val: alerts, set: setAlerts },
                { label: "Push notifications", sub: "Browser push for major moves (>5%)", val: push, set: setPush },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">{row.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{row.sub}</div>
                  </div>
                  <Toggle on={row.val} onChange={row.set} />
                </div>
              ))}
            </div>
          </div>

          {/* AI Behavior */}
          <div className="bg-[#161d27] rounded-2xl border border-[#232c3a] p-6">
            <div className="flex items-center gap-2 mb-5">
              <Sparkles size={15} className="text-amber-accent" />
              <h3 className="text-base font-semibold tracking-tight">AI Behavior</h3>
            </div>
            <div className="space-y-4">
              {[
                { label: "Strict citation mode", sub: "Decline numeric claims without a verified source", val: strictCite, set: setStrictCite },
                { label: "7-day Prophet forecast", sub: "Overlay forecast band on candle charts", val: forecast7d, set: setForecast7d },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">{row.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{row.sub}</div>
                  </div>
                  <Toggle on={row.val} onChange={row.set} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </DashboardShell>
  )
}
