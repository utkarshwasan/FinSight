import { Sparkles, Loader2 } from 'lucide-react'

export default function AnswerPanel({ answer, isGenerating }: { answer: string | null, isGenerating: boolean }) {
  if (!answer && !isGenerating) return null
  
  return (
    <div className="glass-card p-5 rounded-xl border-t-2 border-t-sky-500 relative overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-sky-400" />
        <h3 className="text-sm font-semibold text-slate-200">AI Synthesis</h3>
        {isGenerating && <Loader2 size={14} className="text-sky-400 animate-spin ml-auto" />}
      </div>
      
      <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
        {answer ? (
          <div dangerouslySetInnerHTML={{ __html: answer.replace(/\n/g, '<br/>') }} />
        ) : (
          <div className="flex flex-col gap-2">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-5/6" />
            <div className="skeleton h-4 w-4/6" />
          </div>
        )}
      </div>
    </div>
  )
}
