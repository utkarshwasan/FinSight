import { useMemo } from 'react'
import ReactFlow, { Background } from 'reactflow'
import 'reactflow/dist/style.css'
import AgentNode from './AgentNode'

const nodeTypes = {
  agent: AgentNode,
}

// Fixed layout for the 5+1 nodes
const initialNodes = [
  { id: 'MarketData', type: 'agent', position: { x: 250, y: 50 }, data: { label: 'MarketData', status: 'pending' } },
  { id: 'News', type: 'agent', position: { x: 100, y: 150 }, data: { label: 'News', status: 'pending' } },
  { id: 'Forecast', type: 'agent', position: { x: 400, y: 150 }, data: { label: 'Forecast', status: 'pending' } },
  { id: 'Risk', type: 'agent', position: { x: 250, y: 250 }, data: { label: 'Risk', status: 'pending' } },
  { id: 'Alert', type: 'agent', position: { x: 100, y: 350 }, data: { label: 'Alert', status: 'pending' } },
  { id: 'Synthesis', type: 'agent', position: { x: 400, y: 350 }, data: { label: 'Synthesis', status: 'pending' } },
]

const initialEdges = [
  { id: 'e1', source: 'MarketData', target: 'News', animated: false, style: { stroke: '#475569' } },
  { id: 'e2', source: 'MarketData', target: 'Forecast', animated: false, style: { stroke: '#475569' } },
  { id: 'e3', source: 'News', target: 'Risk', animated: false, style: { stroke: '#475569' } },
  { id: 'e4', source: 'Forecast', target: 'Risk', animated: false, style: { stroke: '#475569' } },
  { id: 'e5', source: 'Risk', target: 'Alert', animated: false, style: { stroke: '#475569' } },
  { id: 'e6', source: 'Risk', target: 'Synthesis', animated: false, style: { stroke: '#475569' } },
]

export default function DAGVisualizer({ events, currentRunId }: { events: { run_id: string, node: string, status: string, latency_ms?: number }[], currentRunId: string | null }) {
  
  // Compute node states based on events for the current run
  const nodes = useMemo(() => {
    if (!currentRunId) return initialNodes
    
    const runEvents = events.filter(e => e.run_id === currentRunId)
    
    return initialNodes.map(node => {
      // Get the latest event for this node
      const nodeEvents = runEvents.filter(e => e.node === node.id)
      const latestEvent = nodeEvents[nodeEvents.length - 1]
      
      if (latestEvent) {
        return {
          ...node,
          data: {
            ...node.data,
            status: latestEvent.status,
            latency_ms: latestEvent.latency_ms
          }
        }
      }
      return node
    })
  }, [events, currentRunId])
  
  const edges = useMemo(() => {
    return initialEdges.map(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source)
      const isAnimating = sourceNode?.data.status === 'running' || sourceNode?.data.status === 'done'
      return {
        ...edge,
        animated: isAnimating,
        style: { stroke: isAnimating ? '#6366F1' : '#334155', strokeWidth: isAnimating ? 2 : 1 }
      }
    })
  }, [nodes])

  return (
    <div style={{ height: 450, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#334155" gap={16} size={1} />
      </ReactFlow>
    </div>
  )
}
