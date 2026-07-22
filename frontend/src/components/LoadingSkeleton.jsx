export default function LoadingSkeleton() {
  return (
    <div className="w-full max-w-md space-y-2 py-1">
      {[1, 0.9, 0.7].map((w, i) => (
        <div
          key={i}
          className="h-3 rounded-full bg-gradient-to-r from-surface via-white/10 to-surface bg-[length:200%_100%] animate-[shimmer_1.6s_ease-in-out_infinite]"
          style={{ width: `${w * 100}%` }}
        />
      ))}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
