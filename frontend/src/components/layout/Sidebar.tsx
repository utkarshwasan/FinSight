import { cn } from "@/lib/utils"
import { Link, useLocation } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { useWsStore } from "@/store/wsStore"
import {
  LayoutDashboard,
  Eye,
  TrendingUp,
  Newspaper,
  ScrollText,
  LogOut,
  Zap
} from "lucide-react"

const navItems = [
  { icon: LayoutDashboard, label: "Overview",  href: "/" },
  { icon: Eye,             label: "Watchlist", href: "/watchlist" },
  { icon: TrendingUp,      label: "Positions", href: "/positions" },
  { icon: Newspaper,       label: "News Feed", href: "/news" },
  { icon: ScrollText,      label: "Audit Log", href: "/audit" },
]

export default function Sidebar() {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const connected = useWsStore((s) => s.connected)

  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: "20px 12px",
        gap: 4,
      }}
    >
      {/* Logo */}
      <div style={{ padding: "0 8px 20px", borderBottom: "1px solid var(--border)", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32,
            borderRadius: 8,
            background: "linear-gradient(135deg, #6366F1, #4F46E5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(99,102,241,0.4)",
            flexShrink: 0,
          }}>
            <Zap size={16} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>
            <span className="glow-text-accent">Fin</span>
            <span style={{ color: "var(--text-primary)" }}>Sight</span>
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "0 12px 8px" }}>
          Navigation
        </p>
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn("nav-item", location.pathname === item.href && "active")}
          >
            <item.icon size={15} style={{ flexShrink: 0 }} />
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Bottom: WS status + user */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Connection status */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 8px" }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: connected ? "var(--green)" : "var(--text-muted)",
            boxShadow: connected ? "0 0 6px var(--green)" : "none",
          }} />
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            {connected ? "Live" : "Disconnected"}
          </span>
        </div>

        {/* User */}
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: "rgba(255,255,255,0.03)" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "var(--accent-dim)",
              border: "1px solid var(--border-glow)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 600, color: "#818CF8",
              flexShrink: 0,
            }}>
              {user.email?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.full_name || user.email}
              </p>
              <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Free tier</p>
            </div>
            <button
              onClick={logout}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 4, display: "flex" }}
              title="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
