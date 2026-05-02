import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import api from '@/lib/api'
import { HoldingsCard } from '@/components/positions/HoldingsCard'
import { AddPositionModal } from '@/components/positions/AddPositionModal'
import { DashboardShell } from '@/components/layout/DashboardShell'

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
    <DashboardShell 
      title="Holdings" 
      subtitle="Manage holdings and monitor live portfolio P&L."
      actions={
        <button
          onClick={() => setShowAddPosition(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#f5b454] hover:bg-[#f7c372] text-[#1a1207] text-sm font-medium transition-all active:scale-[0.98] shadow-lg shadow-[#f5b454]/30 cursor-pointer"
        >
          <Plus size={15} />
          Add Position
        </button>
      }
    >
      <AddPositionModal open={showAddPosition} onClose={() => setShowAddPosition(false)} />

      {isLoading ? (
        <div className="bg-[#161d27] rounded-2xl border border-[#232c3a] p-6">
          <div className="shimmer h-40 rounded-xl w-full" />
        </div>
      ) : (
        <HoldingsCard positions={data || []} onAdd={() => setShowAddPosition(true)} />
      )}
    </DashboardShell>
  )
}
