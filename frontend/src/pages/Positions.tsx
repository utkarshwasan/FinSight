import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BriefcaseBusiness } from 'lucide-react'
import api from '@/lib/api'
import HoldingsCard from '@/components/positions/HoldingsCard'
import AddPositionForm from '@/components/positions/AddPositionForm'

interface Position {
  id: number
  symbol: string
  quantity: number
  average_price: number
}

export default function PositionsPage() {
  const [showAddPosition, setShowAddPosition] = useState(false)

  const { data, isLoading } = useQuery<Position[]>({
    queryKey: ['positions'],
    queryFn: () => api.get('/positions').then((r) => r.data),
  })

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      {showAddPosition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <AddPositionForm onClose={() => setShowAddPosition(false)} />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Positions</h1>
          <p className="text-sm text-slate-400">Manage holdings and monitor live portfolio P&L.</p>
        </div>
        <button
          onClick={() => setShowAddPosition(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all"
        >
          <BriefcaseBusiness size={16} />
          Add Position
        </button>
      </div>

      {isLoading ? (
        <div className="glass-card p-6">
          <p className="text-sm text-slate-400">Loading positions...</p>
        </div>
      ) : (
        <HoldingsCard positions={data || []} />
      )}
    </div>
  )
}
