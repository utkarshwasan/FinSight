import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/authStore"
import { LayoutDashboard, LogOut, User } from "lucide-react"

export default function Navbar() {
  const { user, logout } = useAuthStore()

  return (
    <nav className="h-16 border-b border-slate-800 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-50 flex items-center justify-between px-6">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <LayoutDashboard className="text-white w-5 h-5" />
        </div>
        <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          FinSight
        </span>
      </div>

      <div className="flex items-center gap-4">
        {user ? (
          <>
            <div className="flex items-center gap-2 text-slate-300">
              <User className="w-4 h-4" />
              <span className="text-sm font-medium">{user.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="text-slate-400 hover:text-rose-400">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </>
        ) : (
          <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white">
            Sign In
          </Button>
        )}
      </div>
    </nav>
  )
}
