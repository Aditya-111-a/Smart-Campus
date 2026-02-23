export default function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="sc-card p-6">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 rounded-full bg-cyan-500 animate-pulse" />
        <span className="text-sm font-medium text-slate-600">{label}</span>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 rounded bg-slate-200/80 animate-pulse" />
        <div className="h-3 rounded bg-slate-200/70 animate-pulse w-11/12" />
        <div className="h-3 rounded bg-slate-200/60 animate-pulse w-9/12" />
      </div>
    </div>
  )
}
