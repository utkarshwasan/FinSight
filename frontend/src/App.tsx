import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import DashboardLayout from './components/layout/DashboardLayout'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/Login'
import OverviewPage from './pages/Overview'
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
                <Route path="/watchlist" element={<div className="text-white">Watchlist — coming soon</div>} />
                <Route path="/positions" element={<div className="text-white">Positions — coming soon</div>} />
                <Route path="/news" element={<div className="text-white">News — coming soon</div>} />
                <Route path="/audit" element={<div className="text-white">Audit — coming soon</div>} />
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
