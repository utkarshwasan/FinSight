import { CitationGuard } from "@/lib/citation-guard";

interface Source { n: number; kind: string; headline?: string; url?: string; mape?: number }

export function AnswerPanel({ answer, sources, disclaimer }: {
  answer: string; sources: Source[]; disclaimer: string;
}) {
  const sanitized = CitationGuard.sanitize(answer);
  const isDegraded = answer.trim().startsWith("[degraded]");
  // Replace [n] with hover-able chips
  const parts = sanitized.split(/(\[\d+\])/g);
  return (
    <div className="rounded-xl border border-[#232c3a] bg-[#161d27] p-4 text-sm">
      {isDegraded && (
        <div className="mb-2 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          Partial answer: one or more pipeline stages failed. Results may be incomplete.
        </div>
      )}
      <p className="leading-relaxed">
        {parts.map((p, i) => {
          const m = p.match(/^\[(\d+)\]$/);
          if (!m) return <span key={i}>{p}</span>;
          const n = parseInt(m[1], 10);
          const src = sources.find((s) => s.n === n);
          return (
            <span
              key={i}
              title={src ? (src.headline || `${src.kind}: MAPE=${src.mape}`) : "unknown source"}
              className="inline-block bg-amber-400/20 text-amber-300 rounded px-1 mx-0.5 cursor-help"
            >
              [{n}]
            </span>
          );
        })}
      </p>
      <p className="mt-3 text-xs text-neutral-500 italic">{disclaimer}</p>
      {sources.length > 0 && (
        <ul className="mt-3 text-xs text-neutral-400 space-y-1">
          {sources.map((s) => (
            <li key={s.n}>
              [{s.n}]{" "}
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
                  {s.headline}
                </a>
              ) : (
                `${s.kind} (MAPE=${s.mape?.toFixed(2)})`
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}