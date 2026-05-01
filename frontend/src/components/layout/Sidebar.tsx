import { cn } from "@/lib/utils"
import { 
  LayoutDashboard, 
  TrendingUp, 
  Eye, 
  Newspaper, 
  History, 
  Settings 
} from "lucide-react"
import { Link, useLocation } from "react-router-dom"

const navItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/" },
  { icon: Eye, label: "Watchlist", href: "/watchlist" },
  { icon: TrendingUp, label: "Positions", href: "/positions" },
  { icon: Newspaper, label: "News", href: "/news" },
  { icon: History, label: "Audit Log", href: "/audit" },
  { icon: Settings, label: "Settings", href: "/settings" },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col hidden md:flex">
      <div className="flex-1 py-6 px-4 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              location.pathname === item.href
                ? "bg-blue-600/10 text-blue-400 border border-blue-600/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        ))}
      </div>
      
      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Market Status</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-slate-200">NYSE Open</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
