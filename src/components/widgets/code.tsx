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
      {result.failure !== "load" && (
        <p className="mt-2 text-muted-foreground" data-testid="run-timing">
          Ran in {Math.round(result.durationMs)} ms
        </p>
      )}
    </div>
  );
}

export type PythonRunStatus = "idle" | "loading" | "running" | "load-error";

export function pythonActionLabel(status: PythonRunStatus): string {
  if (status === "loading") return "Loading Python…";
  if (status === "running") return "Running…";
  if (status === "load-error") return "Retry";
  return "Run hidden tests";
}

/** Shared engine for "code" and code-mode "debug" exercises. The Python runtime is loaded once per session. */
export function useCodeRun(tests: string) {
  const [status, setStatus] = useState<PythonRunStatus>("idle");
  const [result, setResult] = useState<RunResult | null>(null);
  const [loadDetail, setLoadDetail] = useState<string | null>(null);
  const inflight = useRef(0);

  useEffect(() => {
    const runner = getRunner("python");
    if (runner.isReady?.()) return;
    let cancel = false;
    const id = window.setTimeout(() => {
      if (cancel || inflight.current > 0) return;
      setStatus("loading");
      void runner
        .prepare?.()
        .then(() => {
          if (!cancel && inflight.current === 0) setStatus("idle");
        })
        .catch((err: unknown) => {
          if (cancel || inflight.current > 0) return;
          setLoadDetail(err instanceof Error ? err.message : String(err));
          setStatus("load-error");
        });
    }, 400);
    return () => {
      cancel = true;
      window.clearTimeout(id);
    };
  }, []);

  const run = async (code: string) => {
    const runner = getRunner("python");
    inflight.current += 1;
    setStatus(runner.isReady?.() ? "running" : "loading");
    try {
      const response = await runner.run({ language: "python", code, tests });
      setResult(response);
      if (response.failure === "load") {
        setLoadDetail(response.error);
        setStatus("load-error");
      } else {
        setLoadDetail(null);
        setStatus("idle");
      }
      return response;
    } finally {
      inflight.current -= 1;
    }
  };

  const retry = async () => {
    const runner = getRunner("python");
    inflight.current += 1;
    setStatus("loading");
    setResult(null);
    try {
      await runner.prepare?.();
      setLoadDetail(null);
      setStatus("idle");
    } catch (err) {
      setLoadDetail(err instanceof Error ? err.message : String(err));
      setStatus("load-error");
    } finally {
      inflight.current -= 1;
    }
  };

  return { status, result, loadDetail, run, retry, warmed: getRunner("python").isWarmed?.() ?? false };
}

export function PythonRunFeedback({
  status,
  result,
  loadDetail,
  warmed,
  onRetry,
}: {
  status: PythonRunStatus;
  result: RunResult | null;
  loadDetail: string | null;
  warmed: boolean;
  onRetry: () => void;
}) {
  return (
    <>
      {status === "loading" && (
        <p className="mt-3 flex items-center gap-2 text-base text-muted-foreground" role="status" data-testid="python-loading">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {warmed ? "Restarting Python…" : "Downloading the Python runtime (first run only, about 10 MB)…"}
        </p>
      )}
      {status === "load-error" && (
        <div role="alert" data-testid="python-load-error" className="mt-3 rounded-lg border-2 border-danger bg-ink p-3">
          <p className="font-bold text-danger">Python failed to load — Retry</p>
          {loadDetail && <p className="mt-1 whitespace-pre-wrap font-mono text-sm text-muted-foreground">{loadDetail}</p>}
          <Button type="button" className="mt-3" onClick={onRetry} data-testid="python-retry">
            Retry
          </Button>
        </div>
      )}
      {status !== "load-error" && result && result.failure !== "load" && <TestReport result={result} />}
    </>
  );
}

export function CodeWidget({ exercise, setAction, onGrade, locked }: WidgetProps<ExerciseOf<"code">>) {
  const [code, setCode] = useState(exercise.starter);
  const [hints, setHints] = useState(0);
  const { status, result, loadDetail, run, retry, warmed } = useCodeRun(exercise.tests);
  const busy = status === "loading" || status === "running";

  usePrimaryAction(
    setAction,
    locked
      ? null
      : {
          label: pythonActionLabel(status),
          busy,
          disabled: busy,
          onPress: async () => {
            if (status === "load-error") {
              await retry();
              return;
            }
            const r = await run(code);
            if (r.failure === "load") return;
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
      <PythonRunFeedback status={status} result={result} loadDetail={loadDetail} warmed={warmed} onRetry={() => void retry()} />
      {result && result.failure !== "load" && status !== "load-error" && !gradeTests(result.tests, result.error).correct && (
        <p className={cn("mt-2 text-base text-muted-foreground")}>Fix the code and run again. Tests stay hidden, but their names give you a clue.</p>
      )}
    </div>
  );
}
