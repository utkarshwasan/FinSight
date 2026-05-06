import { LayoutDashboard, LineChart, Eye, Briefcase, Activity, Settings, Sparkles, LogOut, Newspaper } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { useWsStore } from "@/store/wsStore"

const nav = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Markets",   icon: LineChart,       href: "/markets" },
  { label: "Watchlist", icon: Eye,             href: "/watchlist" },
  { label: "Holdings",  icon: Briefcase,       href: "/holdings" },
  { label: "News",      icon: Newspaper,       href: "/news" },
  { label: "DAG Audit", icon: Activity,        href: "/dag-audit" },
  { label: "Settings",  icon: Settings,        href: "/settings" },
]

export function Sidebar() {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const connected = useWsStore((s) => s.connected)

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "?"

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-[#232c3a] bg-[#121821] sticky top-0 h-screen">
      <div className="px-5 py-5 flex items-center gap-2.5 border-b border-[#232c3a]">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f5b454] to-[#d4922e] flex items-center justify-center shadow-lg shadow-[#f5b454]/20">
          <Sparkles className="text-[#1a1207]" size={18} />
        </div>
        <div>
          <div className="text-[15px] font-display font-semibold tracking-tight">FinSight AI</div>
          <div className="text-[11px] text-slate-500">Market Intelligence</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.label}
              to={item.href}
              className={[
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all duration-200 relative",
                isActive
                  ? "bg-amber/10 text-amber-accent font-medium"
                  : "text-slate-400 hover:bg-white/5 hover:text-white",
              ].join(" ")}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-[#f5b454]" />
              )}
              <item.icon size={17} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-[#232c3a] space-y-2">
        <div className="flex items-center gap-2 px-2 text-[11px] text-slate-500">
          <span className="relative flex w-2 h-2">
            <span className={`absolute inset-0 rounded-full ${connected ? "bg-emerald-500 live-dot" : "bg-slate-500"}`} />
          </span>
          <span>{connected ? "Live · WS connected" : "Disconnected"}</span>
        </div>
        <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f5b454] to-[#a86d1e] flex items-center justify-center text-[12px] font-semibold text-[#1a1207]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium truncate">{user?.full_name || user?.email || "Demo User"}</div>
            <div className="text-[11px] text-slate-500 truncate">Pro · Free tier</div>
          </div>
          <button
            onClick={logout}
            className="text-slate-500 hover:text-rose-400 transition-colors p-1"
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}
