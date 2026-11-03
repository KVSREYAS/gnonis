"use client";

import type { ReactNode } from "react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export type GameResult = { won: boolean; summary: string };
export type GameProps<C> = { id: string; cfg: C; seed: number; locked: boolean; onDone: (r: GameResult) => void };

export function Btn({
  children,
  onClick,
  disabled,
  active,
  tone = "gold",
  testId,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  tone?: "gold" | "green" | "red" | "muted";
  testId?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      aria-pressed={active}
      className={cn(
        "min-h-11 rounded-lg border-2 bg-ink px-4 py-2 text-base font-bold text-foreground transition-colors disabled:opacity-40",
        active
          ? tone === "green"
            ? "border-money bg-money/20"
            : tone === "red"
              ? "border-danger bg-danger/20"
              : "border-gold bg-gold/20"
          : "border-border hover:border-gold",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-border bg-ink px-3 py-2">
      <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">{label}</p>
      <p className={cn("font-mono text-lg", tone === "good" ? "text-money-ink" : tone === "bad" ? "text-danger" : "text-gold-ink")}>{value}</p>
    </div>
  );
}

export function Stats({ children }: { children: ReactNode }) {
  return <div className="my-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>;
}

export function NumSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  unit,
  disabled,
  testId,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  unit?: string;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <div className="my-3">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-base font-bold">{label}</span>
        <span className="font-mono text-base text-gold-ink">
          {Number.isInteger(step) ? value : value.toFixed(String(step).split(".")[1]?.length ?? 1)}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <Slider
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={[value]}
        disabled={disabled}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : (v as number))}
        data-testid={testId}
      />
    </div>
  );
}

export function Note({ children, tone }: { children: ReactNode; tone?: "good" | "bad" }) {
  return (
    <p
      className={cn("my-3 rounded-lg border-2 bg-ink p-3 text-base", tone === "good" ? "border-money" : tone === "bad" ? "border-danger" : "border-gold/60")}
      aria-live="polite"
    >
      {children}
    </p>
  );
}

export function Log({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <ol className="my-3 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border bg-ink p-3 font-mono text-sm">
      {lines.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ol>
  );
}

export const fmt = (n: number, d = 0) => n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: 0 });
export const rupees = (n: number) => `₹${fmt(Math.round(n))}`;
