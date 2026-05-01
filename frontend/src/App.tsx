import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import DashboardLayout from './components/layout/DashboardLayout'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/Login'
import OverviewPage from './pages/Overview'
import AuditLog from './pages/AuditLog'
import WatchlistPage from './pages/Watchlist'
import PositionsPage from './pages/Positions'
import NewsPage from './pages/News'
import { useAuthStore } from './store/authStore'
import { connectWS } from './lib/ws'


function App() {
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (token) connectWS()
  }, [token])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/watchlist" element={<WatchlistPage />} />
                <Route path="/positions" element={<PositionsPage />} />
                <Route path="/news" element={<NewsPage />} />
                <Route path="/audit" element={<AuditLog />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
