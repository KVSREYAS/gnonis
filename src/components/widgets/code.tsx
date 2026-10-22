"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Lightbulb, Loader2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExerciseOf } from "@/lib/content/schema";
import { gradeTests } from "@/lib/grading";
import { getRunner, type RunResult } from "@/lib/runner";
import { cn } from "@/lib/utils";
import { Prompt } from "./inline-text";
import type { WidgetProps } from "./types";
import { usePrimaryAction } from "./useAction";

export function CodeEditor({ value, onChange, disabled, label }: { value: string; onChange: (v: string) => void; disabled?: boolean; label: string }) {
  const lines = value.split("\n").length;
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="flex overflow-hidden rounded-lg border-2 border-border bg-ink focus-within:border-gold">
      <pre aria-hidden className="select-none border-r border-border px-2 py-3 text-right font-mono text-sm leading-6 text-muted-foreground">
        {Array.from({ length: lines }, (_, i) => i + 1).join("\n")}
      </pre>
      <textarea
        ref={ref}
        aria-label={label}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Tab" || e.shiftKey) return;
          e.preventDefault();
          const el = e.currentTarget;
          const { selectionStart: s, selectionEnd: t } = el;
          const next = value.slice(0, s) + "    " + value.slice(t);
          onChange(next);
          requestAnimationFrame(() => {
            el.selectionStart = el.selectionEnd = s + 4;
          });
        }}
        rows={Math.max(8, lines + 1)}
        className="w-full resize-y bg-transparent px-3 py-3 font-mono text-sm leading-6 whitespace-pre text-foreground outline-none"
        data-testid="code-editor"
      />
    </div>
  );
}

export function TestReport({ result }: { result: RunResult }) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-ink p-3 text-sm" aria-live="polite" data-testid="test-report">
      {result.error && <pre className="mb-2 whitespace-pre-wrap font-mono text-danger">{result.error}</pre>}
      <ul className="space-y-1">
        {result.tests.map((t) => (
          <li key={t.name} className="flex items-start gap-2">
            {t.passed ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-money-ink" aria-label="passed" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-label="failed" />}
            <span className="text-foreground">
              {t.name}
              {!t.passed && t.message && <span className="block font-mono text-muted-foreground">{t.message}</span>}
            </span>
          </li>
        ))}
      </ul>
      {result.stdout && (
        <details className="mt-2">
          <summary className="cursor-pointer text-muted-foreground">Your print output</summary>
          <pre className="mt-1 whitespace-pre-wrap font-mono text-foreground">{result.stdout}</pre>
        </details>
      )}
      <p className="mt-2 text-muted-foreground">Ran in {Math.round(result.durationMs)} ms</p>
    </div>
  );
}

/** Shared engine for "code" and code-mode "debug" exercises. */
export function useCodeRun(tests: string) {
  const [status, setStatus] = useState<"idle" | "loading" | "running">("idle");
  const [result, setResult] = useState<RunResult | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    // Warm Pyodide in the background as soon as a code exercise is on screen.
    const runner = getRunner("python");
    const id = setTimeout(() => void runner.prepare?.().catch(() => {}), 400);
    return () => clearTimeout(id);
  }, []);

  const run = async (code: string) => {
    setStatus(firstRun.current ? "loading" : "running");
    const r = await getRunner("python").run({ language: "python", code, tests });
    firstRun.current = false;
    setResult(r);
    setStatus("idle");
    return r;
  };
  return { status, result, run };
}

export function CodeWidget({ exercise, setAction, onGrade, locked }: WidgetProps<ExerciseOf<"code">>) {
  const [code, setCode] = useState(exercise.starter);
  const [hints, setHints] = useState(0);
  const { status, result, run } = useCodeRun(exercise.tests);
  const busy = status !== "idle";

  usePrimaryAction(
    setAction,
    locked
      ? null
      : {
          label: status === "loading" ? "Loading Python…" : status === "running" ? "Running…" : "Run hidden tests",
          busy,
          disabled: busy,
          onPress: async () => {
            const r = await run(code);
            const g = gradeTests(r.tests, r.error);
            if (g.correct) onGrade({ correct: true, message: `${g.message} ${exercise.explanation}` });
          },
        },
  );

  return (
    <div>
      <p className="mb-1 font-display text-sm tracking-widest text-gold-ink">PYTHON · RUNS IN YOUR BROWSER</p>
      <Prompt text={exercise.prompt} />
      <CodeEditor value={code} onChange={setCode} disabled={locked} label="Python code editor" />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => setCode(exercise.starter)} disabled={locked}>
          <RotateCcw className="size-4" /> Reset code
        </Button>
        {hints < exercise.hints.length && !locked && (
          <Button variant="ghost" size="sm" onClick={() => setHints((h) => h + 1)}>
            <Lightbulb className="size-4" /> Hint {hints + 1}/{exercise.hints.length}
          </Button>
        )}
      </div>
      {hints > 0 && (
        <ul className="mt-2 space-y-1 rounded-lg border border-border bg-ink p-3 text-base">
          {exercise.hints.slice(0, hints).map((h) => (
            <li key={h}>
              <Lightbulb className="mr-1 inline size-4 text-gold-ink" aria-hidden />
              {h}
            </li>
          ))}
        </ul>
      )}
      {status === "loading" && (
        <p className="mt-3 flex items-center gap-2 text-base text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Downloading the Python runtime (first run only, about 10 MB)…
        </p>
      )}
      {result && <TestReport result={result} />}
      {result && !gradeTests(result.tests, result.error).correct && (
        <p className={cn("mt-2 text-base text-muted-foreground")}>Fix the code and run again. Tests stay hidden, but their names give you a clue.</p>
      )}
    </div>
  );
}
