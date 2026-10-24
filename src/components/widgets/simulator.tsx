"use client";

import { useMemo, useState } from "react";
import { Target } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Chart, Gauge } from "@/components/viz";
import type { ExerciseOf } from "@/lib/content/schema";
import { formatNumber, goalMet, gradeSim } from "@/lib/grading";
import { defaultValues, getSim, type SliderDef, type Values } from "@/lib/sims";
import { cn } from "@/lib/utils";
import { Prompt } from "./inline-text";
import type { WidgetProps } from "./types";
import { usePrimaryAction } from "./useAction";

function SimSlider({ def, value, onChange, disabled }: { def: SliderDef; value: number; onChange: (v: number) => void; disabled: boolean }) {
  const id = `slider-${def.id}`;
  if (def.options) {
    const idx = Math.max(0, def.options.findIndex((o) => o.value === value));
    return (
      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <label htmlFor={id} className="text-base font-bold">
            {def.label}
          </label>
          <span className="font-mono text-base text-gold-ink">
            {def.options[idx]?.label}
            {def.unit ? ` ${def.unit}` : ""}
          </span>
        </div>
        <Slider
          id={id}
          aria-label={def.label}
          min={0}
          max={def.options.length - 1}
          step={1}
          value={[idx]}
          disabled={disabled}
          onValueChange={(v) => onChange(def.options![Array.isArray(v) ? v[0] : v].value)}
          data-testid={id}
        />
        {def.help && <p className="mt-0.5 text-sm text-muted-foreground">{def.help}</p>}
      </div>
    );
  }
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-base font-bold">
          {def.label}
        </label>
        <span className="font-mono text-base text-gold-ink">
          {formatNumber(value)}
          {def.unit ? ` ${def.unit}` : ""}
        </span>
      </div>
      <Slider
        id={id}
        aria-label={def.label}
        min={def.min}
        max={def.max}
        step={def.step}
        value={[value]}
        disabled={disabled}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
        data-testid={id}
      />
      {def.help && <p className="mt-0.5 text-sm text-muted-foreground">{def.help}</p>}
    </div>
  );
}

export function SimulatorWidget({ exercise, setAction, onGrade, locked }: WidgetProps<ExerciseOf<"simulator">>) {
  const sim = getSim(exercise.sim);
  const [values, setValues] = useState<Values>(() => (sim ? defaultValues(sim, exercise.params) : {}));
  const [moved, setMoved] = useState(false);
  const outputs = useMemo(() => (sim ? sim.compute(values) : {}), [sim, values]);
  const met = exercise.goal ? goalMet(exercise.goal, outputs) : true;

  usePrimaryAction(
    setAction,
    locked || !sim
      ? null
      : exercise.goal
        ? { label: met ? "Goal reached: check" : "Check goal", onPress: () => onGrade(gradeSim(exercise.goal, outputs, exercise.explanation)) }
        : { label: moved ? "Done exploring" : "Try a slider first", disabled: !moved, onPress: () => onGrade(gradeSim(undefined, outputs, exercise.explanation)) },
  );

  if (!sim) return <p className="text-danger">Unknown simulator “{exercise.sim}”.</p>;
  const locks = new Set(exercise.locked ?? []);
  const shown = sim.sliders.filter((s) => !locks.has(s.id));
  const chart = sim.chart(values, outputs);

  return (
    <div>
      <p className="mb-1 font-display text-sm tracking-widest text-gold-ink">SIMULATOR · {sim.title.toUpperCase()}</p>
      <Prompt text={exercise.prompt} />
      {exercise.goal && (
        <p
          className={cn(
            "mb-4 flex items-start gap-2 rounded-lg border-2 bg-ink p-3 text-base",
            met ? "border-money" : "border-gold/60",
          )}
          data-testid="sim-goal"
          aria-live="polite"
        >
          <Target className={cn("mt-0.5 size-5 shrink-0", met ? "text-money-ink" : "text-gold-ink")} aria-hidden />
          <span>
            <strong>{met ? "Goal met. " : "Goal: "}</strong>
            {exercise.goal.description}
          </span>
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          {shown.map((def) => (
            <SimSlider
              key={def.id}
              def={def}
              value={values[def.id]}
              disabled={locked}
              onChange={(v) => {
                setValues((prev) => ({ ...prev, [def.id]: v }));
                setMoved(true);
              }}
            />
          ))}
          {locks.size > 0 && (
            <p className="text-sm text-muted-foreground">
              Fixed:{" "}
              {sim.sliders
                .filter((s) => locks.has(s.id))
                .map((s) => `${s.label} ${s.options?.find((o) => o.value === values[s.id])?.label ?? formatNumber(values[s.id])}${s.unit ? " " + s.unit : ""}`)
                .join(" · ")}
            </p>
          )}
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {sim.gauges.map((g) => {
              const def = sim.outputs.find((o) => o.id === g.output);
              return <Gauge key={g.output} value={outputs[g.output]} max={g.max(values)} danger={g.danger?.(values)} label={g.label} unit={def?.unit} />;
            })}
          </div>
          <Chart spec={chart} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-border bg-ink p-3 text-sm sm:grid-cols-3">
            {sim.outputs.map((o) => (
              <div key={o.id} className={cn(exercise.goal?.output === o.id && "text-gold-ink")}>
                <dt className="text-muted-foreground">{o.label}</dt>
                <dd className="font-mono text-base text-foreground tabular-nums" data-testid={`sim-out-${o.id}`}>
                  {formatNumber(Number((outputs[o.id] ?? 0).toFixed(o.digits ?? 2)))}
                  {o.unit ? ` ${o.unit}` : ""}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
