import { useMemo } from 'react'

// Pattern for numeric claims: $123, 45%, 12.5%, etc.
// Matches numbers that are NOT followed by a [n] citation
const NUMERIC_PATTERN = /\$?\d+(?:\.\d+)?%?(?!\s*\[\d+\])/g

// Patterns to exclude (false positives)
const FALSE_POSITIVE_PATTERNS = [
  /\d{4}/, // Years like 2024
]

function isFalsePositive(match: string): boolean {
  return FALSE_POSITIVE_PATTERNS.some(pattern => pattern.test(match))
}

export function findUncitedNumerics(text: string): string[] {
  const matches = text.match(NUMERIC_PATTERN) || []
  return matches.filter(m => {
    const num = parseFloat(m.replace(/\$/g, '').replace(/%/g, ''))
    return !isNaN(num) && num < 10000 && !isFalsePositive(m)
  })
}

export function sanitizeText(text: string): string {
  const uncited = findUncitedNumerics(text)
  if (uncited.length === 0) return text
  
  return text.replace(NUMERIC_PATTERN, (match) => {
    const num = parseFloat(match.replace(/\$/g, '').replace(/%/g, ''))
    if (isNaN(num) || num >= 10000 || isFalsePositive(match)) {
      return match
    }
    return `[REDACTED: uncited numeric]`
  })
}

export function CitationChip({ children, source }: { children: React.ReactNode; source?: string }) {
  return (
    <sup className="text-[10px] font-bold text-amber-accent bg-amber/20 rounded px-1 cursor-help" title={source || 'Citation'}>
      {children}
    </sup>
  )
}

export function CitationGuard({ text }: { text: string }) {
  const safeText = useMemo(() => sanitizeText(text), [text])
  
  return <span className="text-slate-200">{safeText}</span>
}

// Helper to extract and display citations
export function CitationList({ text }: { text: string }) {
  const citations = useMemo(() => {
    const matches = text.match(/\[(\d+)\]/g) || []
    return [...new Set(matches)].map(c => parseInt(c.slice(1, -1)))
  }, [text])
  
  if (citations.length === 0) return null
  
  return (
    <div className="flex flex-wrap gap-2 pt-2 border-t border-[#232c3a] mt-2">
      {citations.map(c => (
        <a
          key={c}
          className="text-[11px] text-amber-accent hover:text-amber-400 flex items-center gap-1 cursor-pointer"
        >
          [{c}]
        </a>
      ))}
    </div>
  )
}