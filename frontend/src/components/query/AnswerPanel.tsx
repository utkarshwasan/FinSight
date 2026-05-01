import { Sparkles, Loader2 } from 'lucide-react'

export default function AnswerPanel({ answer, isGenerating }: { answer: string | null, isGenerating: boolean }) {
  if (!answer && !isGenerating) return null
  
  return (
    <div className="glass-card p-5 rounded-xl border border-indigo-500/30 bg-slate-900/80 shadow-[0_0_30px_rgba(99,102,241,0.1)] relative overflow-hidden">
      {/* Decorative top border */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
      
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-indigo-400" />
        <h3 className="text-sm font-semibold text-slate-200">AI Synthesis</h3>
        {isGenerating && <Loader2 size={14} className="text-indigo-400 animate-spin ml-auto" />}
      </div>
      
      <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
        {answer || (
          <div className="flex flex-col gap-2">
            <div className="h-4 bg-slate-800 rounded animate-pulse w-full" />
            <div className="h-4 bg-slate-800 rounded animate-pulse w-5/6" />
            <div className="h-4 bg-slate-800 rounded animate-pulse w-4/6" />
          </div>
        )}
      </div>
    </div>
  )
}
