import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Shield, Clock, Search, Terminal, Activity } from 'lucide-react'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default function AuditLog() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit'],
    queryFn: () => api.get('/audit').then(r => r.data)
  })

  return (
    <DashboardShell 
      title="DAG Audit" 
      subtitle="Transparent tracking of all AI operations and account activity."
    >
      <div className="bg-[#161d27] rounded-2xl border border-[#232c3a] overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-[#232c3a] bg-[#1c2532]/50">
                <th className="px-6 py-4 font-medium">Timestamp</th>
                <th className="px-6 py-4 font-medium">Event Type</th>
                <th className="px-6 py-4 font-medium">Trace Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232c3a]">
              {logs?.map((log: { id: number, created_at: string, event_type: string, payload: string }) => {
                let formattedPayload = log.payload
                try {
                  const parsed = JSON.parse(log.payload)
                  formattedPayload = JSON.stringify(parsed, null, 2)
                } catch {
                  // Ignore
                }
                
                return (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2.5">
                        <Clock size={14} className="text-slate-500" />
                        <span className="tabular-nums text-slate-300">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] uppercase font-semibold bg-amber/10 text-amber-accent border border-amber/20">
                        {log.event_type === 'dag_query' ? <Activity size={12}/> : <Terminal size={12}/>}
                        {log.event_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm max-w-md">
                      <div className="bg-[#0b1015] border border-[#232c3a] p-2.5 rounded-xl group-hover:border-amber/30 transition-colors">
                        <code className="text-[11px] text-slate-400 font-mono block truncate overflow-hidden">
                          {formattedPayload}
                        </code>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {isLoading && (
                <tr>
                  <td colSpan={3} className="px-6 py-20 text-center">
                    <div className="shimmer h-8 rounded-xl w-64 mx-auto" />
                  </td>
                </tr>
              )}
              {logs?.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-20 text-center text-slate-500">
                    <Shield size={32} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No audit logs found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  )
}
