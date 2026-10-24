import type { ChartSpec } from "@/lib/sims";
import { formatNumber } from "@/lib/grading";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  gold: "var(--gold)",
  green: "var(--money)",
  red: "var(--danger)",
  muted: "var(--text-muted)",
};

/** Half-circle needle gauge. */
export function Gauge({ value, max, danger, label, unit }: { value: number; max: number; danger?: number; label: string; unit?: string }) {
  const frac = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const over = value > (danger ?? max);
  const angle = Math.PI * (1 - frac);
  const r = 52;
  const cx = 64;
  const cy = 64;
  const nx = cx + r * Math.cos(angle);
  const ny = cy - r * Math.sin(angle);
  const dangerFrac = danger !== undefined && max > 0 ? Math.min(1, danger / max) : 1;
  const da = Math.PI * (1 - dangerFrac);
  return (
    <figure className="flex flex-col items-center rounded-lg border border-border bg-ink p-3" aria-label={`${label}: ${formatNumber(value)}${unit ? " " + unit : ""}`}>
      <svg viewBox="0 0 128 76" className="w-full max-w-44" aria-hidden>
        <path d={`M12 64 A52 52 0 0 1 116 64`} fill="none" stroke="var(--panel-2)" strokeWidth="10" strokeLinecap="round" />
        {dangerFrac < 1 && (
          <path
            d={`M${cx + r * Math.cos(da)} ${cy - r * Math.sin(da)} A52 52 0 0 1 116 64`}
            fill="none"
            stroke="var(--danger)"
            strokeOpacity="0.55"
            strokeWidth="10"
          />
        )}
        <path
          d={`M12 64 A52 52 0 0 1 ${nx} ${ny}`}
          fill="none"
          stroke={over ? "var(--danger)" : "var(--gold)"}
          strokeWidth="10"
          strokeLinecap="round"
          style={{ transition: "all 200ms ease-out" }}
        />
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--text)" strokeWidth="2.5" style={{ transition: "all 200ms ease-out" }} />
        <circle cx={cx} cy={cy} r="4" fill="var(--text)" />
      </svg>
      <figcaption className="mt-1 text-center">
        <span className={cn("block font-display text-2xl tabular-nums", over ? "text-danger" : "text-foreground")}>
          {formatNumber(value)}
          {unit && <span className="ml-1 text-base text-muted-foreground">{unit}</span>}
        </span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </figcaption>
    </figure>
  );
}

function ticks(min: number, max: number, log: boolean): number[] {
  if (log) {
    const out: number[] = [];
    const a = Math.floor(Math.log10(min));
    const b = Math.ceil(Math.log10(max));
    for (let e = a; e <= b; e++) out.push(10 ** e);
    return out.filter((t) => t >= min * 0.999 && t <= max * 1.001);
  }
  const step = niceStep((max - min) / 4);
  const out: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) out.push(t);
  return out;
}
function niceStep(raw: number) {
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}
const short = (n: number) =>
  n >= 1e6 ? `${formatNumber(n / 1e6)}M` : n >= 1e3 ? `${formatNumber(n / 1e3)}k` : formatNumber(n);

export function Chart({ spec }: { spec: ChartSpec }) {
  if (spec.kind === "bars") return <BarChart spec={spec} />;
  const W = 360;
  const H = 200;
  const P = { l: 44, r: 12, t: 12, b: 34 };
  const all = spec.series.flatMap((s) => s.points);
  if (spec.marker) all.push([spec.marker.x, spec.marker.y]);
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]).filter((y) => !spec.logY || y > 0);
  let [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  let [y0, y1] = [spec.logY ? Math.min(...ys) : 0, Math.max(...ys) * 1.08];
  if (x0 === x1) x1 = x0 + 1;
  if (y0 === y1) y1 = y0 + 1;
  if (spec.logY) {
    y0 = 10 ** Math.floor(Math.log10(y0));
    y1 = 10 ** Math.ceil(Math.log10(y1));
  }
  if (spec.logX) {
    x0 = Math.max(x0, 1e-9);
  }
  const sx = (x: number) =>
    P.l + (spec.logX ? (Math.log(x) - Math.log(x0)) / (Math.log(x1) - Math.log(x0)) : (x - x0) / (x1 - x0)) * (W - P.l - P.r);
  const sy = (y: number) =>
    H - P.b - (spec.logY ? (Math.log(Math.max(y, y0)) - Math.log(y0)) / (Math.log(y1) - Math.log(y0)) : (y - y0) / (y1 - y0)) * (H - P.t - P.b);
  const xt = spec.logX ? spec.series[0].points.map((p) => p[0]).filter((_, i, a) => i % Math.ceil(a.length / 6) === 0) : ticks(x0, x1, false);
  const yt = ticks(y0, y1, !!spec.logY);

  return (
    <figure className="rounded-lg border border-border bg-ink p-3">
      <figcaption className="mb-1 text-sm font-bold text-foreground">{spec.title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${spec.title} chart`}>
        {yt.map((t) => (
          <g key={`y${t}`}>
            <line x1={P.l} x2={W - P.r} y1={sy(t)} y2={sy(t)} stroke="var(--line)" />
            <text x={P.l - 6} y={sy(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">
              {short(t)}
            </text>
          </g>
        ))}
        {xt.map((t) => (
          <text key={`x${t}`} x={sx(t)} y={H - P.b + 16} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
            {short(t)}
          </text>
        ))}
        <text x={(W + P.l) / 2} y={H - 4} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
          {spec.xLabel}
        </text>
        <text x={10} y={P.t + 4} fontSize="11" fill="var(--text-muted)">
          {spec.yLabel}
        </text>
        {spec.series.map((s) => (
          <polyline
            key={s.label}
            fill="none"
            stroke={TONE[s.tone]}
            strokeWidth="2.5"
            strokeDasharray={s.tone === "red" ? "6 4" : undefined}
            points={s.points.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" ")}
          />
        ))}
        {spec.marker && (
          <g style={{ transition: "transform 200ms" }}>
            <circle cx={sx(spec.marker.x)} cy={sy(spec.marker.y)} r="7" fill="var(--money)" stroke="var(--ink)" strokeWidth="2" />
            <text x={sx(spec.marker.x)} y={sy(spec.marker.y) - 12} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text)">
              {spec.marker.label}
            </text>
          </g>
        )}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
        {spec.series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1 w-4 rounded" style={{ background: TONE[s.tone] }} />
            {s.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

function BarChart({ spec }: { spec: Extract<ChartSpec, { kind: "bars" }> }) {
  const max = Math.max(...spec.bars.map((b) => b.value), 1e-9);
  return (
    <figure className="rounded-lg border border-border bg-ink p-3">
      <figcaption className="mb-2 text-sm font-bold text-foreground">{spec.title}</figcaption>
      <BarsList bars={spec.bars} max={max} unit={spec.unit} />
    </figure>
  );
}

export function BarsList({
  bars,
  max,
  unit,
}: {
  bars: { label: string; value: number; tone?: string }[];
  max: number;
  unit?: string;
}) {
  return (
    <ul className="space-y-1.5">
      {bars.map((b) => (
        <li key={b.label} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-2 text-sm">
          <span className="truncate font-mono text-foreground">{b.label}</span>
          <span className="h-4 overflow-hidden rounded bg-panel-2">
            <span
              className="block h-full rounded"
              style={{ width: `${Math.max(0, Math.min(100, (b.value / max) * 100))}%`, background: TONE[b.tone ?? "gold"], transition: "width 200ms ease-out" }}
            />
          </span>
          <span className="text-right tabular-nums text-foreground">
            {formatNumber(b.value)}
            {unit ? ` ${unit}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Mini radar: progress ring with a sweep, shown in the lesson header. */
export function Radar({ value, total, className }: { value: number; total: number; className?: string }) {
  const frac = total ? value / total : 0;
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <span className={cn("relative inline-grid size-12 place-items-center", className)} role="img" aria-label={`Lesson progress ${value} of ${total}`}>
      <svg viewBox="0 0 48 48" className="absolute inset-0" aria-hidden>
        <circle cx="24" cy="24" r="22" fill="var(--ink)" stroke="var(--line)" />
        <circle cx="24" cy="24" r="11" fill="none" stroke="var(--line)" />
        <line x1="24" y1="2" x2="24" y2="46" stroke="var(--line)" />
        <line x1="2" y1="24" x2="46" y2="24" stroke="var(--line)" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="var(--money)"
          strokeWidth="4"
          strokeDasharray={`${c * frac} ${c}`}
          transform="rotate(-90 24 24)"
          style={{ transition: "stroke-dasharray 300ms ease-out" }}
        />
        <circle cx="24" cy="24" r="2.5" fill="var(--gold)" />
      </svg>
      <span className="sr-only">
        {value}/{total}
      </span>
    </span>
  );
}
