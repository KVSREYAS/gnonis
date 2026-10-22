export function RespectBar({ value, label = "Respect" }: { value: number; label?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-bold tracking-widest text-foreground uppercase">{label}</span>
        <span className="font-mono text-foreground tabular-nums">{value}%</span>
      </div>
      <div
        className="h-3 overflow-hidden rounded-sm border border-border bg-ink"
        role="progressbar"
        aria-label={`${label} (course mastery)`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <div className="h-full bg-money transition-[width] duration-500" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
