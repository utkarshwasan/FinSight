import { Menu } from "lucide-react"
import { Sidebar } from "./Sidebar"
import type { ReactNode } from "react"

type Props = {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}

export function DashboardShell({ title, subtitle, actions, children }: Props) {
  return (
    <div className="min-h-screen flex bg-[#0b1015]">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-[1280px] mx-auto px-6 py-8 space-y-8">
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <button className="lg:hidden w-9 h-9 rounded-lg bg-[#161d27] border border-[#232c3a] flex items-center justify-center cursor-pointer">
                  <Menu size={16} />
                </button>
                <h1 className="text-2xl sm:text-[28px] font-display font-semibold tracking-tight">
                  {title}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-bull/10 border border-emerald-500/20 text-bull text-[11px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-bull live-dot" />
                  Live
                </span>
              </div>
              {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
            </div>
            {actions}
          </header>

          {children}

          <footer className="text-[11px] text-slate-600 pt-4 pb-2 text-center">
            FinSight AI · Educational use only · Forecasts are illustrative, not investment advice.
          </footer>
        </div>
      </main>
    </div>
  )
}
