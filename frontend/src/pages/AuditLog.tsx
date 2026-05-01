import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Shield, Clock, Search, Terminal } from 'lucide-react'

export default function AuditLog() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit'],
    queryFn: () => api.get('/audit').then(r => r.data)
  })

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="text-indigo-400" size={32} />
            Security & Audit Log
          </h1>
          <p className="text-slate-400 mt-2">Transparent tracking of all AI operations and account activity.</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-bottom border-slate-800 bg-slate-900/50">
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Event Type</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {logs?.map((log: { id: number, created_at: string, event_type: string, payload: string }) => {
                let formattedPayload = log.payload
                try {
                  const parsed = JSON.parse(log.payload)
                  formattedPayload = JSON.stringify(parsed, null, 2)
                } catch {
                  // Ignore parsing errors, keep raw string
                }
                
                return (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-slate-500" />
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {log.event_type === 'dag_query' ? <Search size={12}/> : <Terminal size={12}/>}
                        {log.event_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400 max-w-md">
                      <code className="text-xs bg-black/30 p-2 rounded block truncate">
                        {formattedPayload}
                      </code>
                    </td>
                  </tr>
                )
              })}
              {isLoading && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                    Loading audit trail...
                  </td>
                </tr>
              )}
              {logs?.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                    No audit logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
