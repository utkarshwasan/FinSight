import { useWsStore } from "@/store/wsStore"
import { Bell, Search } from "lucide-react"

interface TopbarProps {
  title: string
  subtitle?: string
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  const alerts = useWsStore((s) => s.alerts)
  const unread = alerts.length

  return (
    <header style={{
      height: 60,
      borderBottom: "1px solid var(--border)",
      background: "var(--bg-overlay)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 24px",
      flexShrink: 0,
      position: "sticky",
      top: 0,
      zIndex: 40,
    }}>
      <div>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          {title}
        </h1>
        {subtitle && <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{subtitle}</p>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Search */}
        <button style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "6px 12px",
          cursor: "pointer",
          color: "var(--text-secondary)",
          fontSize: 12,
          transition: "all 150ms",
        }}>
          <Search size={13} />
          <span>Search</span>
          <span style={{ marginLeft: 8, fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>⌘K</span>
        </button>

        {/* Alerts bell */}
        <button style={{
          position: "relative",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 7,
          cursor: "pointer",
          color: "var(--text-secondary)",
          display: "flex",
        }}>
          <Bell size={15} />
          {unread > 0 && (
            <span style={{
              position: "absolute",
              top: 4, right: 4,
              width: 8, height: 8,
              background: "var(--red)",
              borderRadius: "50%",
              border: "1px solid var(--bg-base)",
            }} />
          )}
        </button>
      </div>
    </header>
  )
}
