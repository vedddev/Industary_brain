const LINES = [100, 92, 68];

export default function LoadingSkeleton({ label = "Analyzing your documents" }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="w-full max-w-md py-1">
      {/* Status label with animated dots */}
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-500">
        <span className="flex items-center gap-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-emerald-600 motion-safe:animate-[iib-pulse_1.2s_ease-in-out_infinite]"
              style={{ animationDelay: `${i * 0.16}s` }}
            />
          ))}
        </span>
        <span>{label}…</span>
      </div>

      {/* Shimmering text lines */}
      <div className="space-y-2.5" aria-hidden="true">
        {LINES.map((width, i) => (
          <div
            key={i}
            className="h-3 rounded-full bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] motion-safe:animate-[iib-shimmer_1.6s_ease-in-out_infinite]"
            style={{ width: `${width}%`, animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>

      <span className="sr-only">{label}, please wait</span>

      <style>{`
        @keyframes iib-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes iib-pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40%           { opacity: 1;   transform: scale(1); }
        }
      `}</style>
    </div>
  );
}