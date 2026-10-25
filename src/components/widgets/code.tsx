"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Lightbulb, Loader2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers";
import { useLessonId } from "@/components/lesson/lesson-context";
import type { ExerciseOf } from "@/lib/content/schema";
import { gradeTests } from "@/lib/grading";
import { getRunner, type RunResult } from "@/lib/runner";
import { requestCpp } from "@/lib/runner/cpp-client";
import { CodeEditor } from "./code-editor";
import { Prompt } from "./inline-text";
import type { WidgetProps } from "./types";
import { usePrimaryAction } from "./useAction";

export { CodeEditor };

export function TestReport({ result, scoreTestId = "submit-score" }: { result: RunResult; scoreTestId?: string }) {
  const passed = result.tests.filter((test) => test.passed).length;
  return (
    <div className="rounded-lg border border-border bg-ink p-3 text-sm" aria-live="polite">
      {result.tests.length > 0 && (
        <p className="mb-2 font-bold text-foreground" data-testid={scoreTestId}>
          {passed}/{result.tests.length} passed
        </p>
      )}
      {result.error && <pre className="mb-2 whitespace-pre-wrap font-mono text-danger">{result.error}</pre>}
      {result.tests.length > 0 && (
        <ul className="space-y-1">
          {result.tests.map((test) => (
            <li key={test.name} className="flex items-start gap-2">
              {test.passed ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-money-ink" aria-label="passed" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-label="failed" />}
              <span className="text-foreground">
                {test.name}
                {!test.passed && test.message && <span className="block font-mono text-muted-foreground">{test.message}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {result.stdout && (
        <div className="mt-2">
          <p className="text-muted-foreground">stdout</p>
          <pre className="mt-1 whitespace-pre-wrap font-mono text-foreground">{result.stdout}</pre>
        </div>
      )}
      {result.stderr && (
        <div className="mt-2">
          <p className="text-muted-foreground">stderr</p>
          <pre className="mt-1 whitespace-pre-wrap font-mono text-foreground">{result.stderr}</pre>
        </div>
      )}
      {result.failure !== "load" && result.failure !== "unavailable" && (
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
  if (status === "running") return "Submitting…";
  if (status === "load-error") return "Retry";
  return "Submit";
}

/** Shared Python runtime for code exercises and code-mode debug. Loaded once per session. */
export function usePythonSession(enabled = true) {
  const [status, setStatus] = useState<PythonRunStatus>("idle");
  const [result, setResult] = useState<RunResult | null>(null);
  const [loadDetail, setLoadDetail] = useState<string | null>(null);
  const inflight = useRef(0);

  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled]);

  const run = async (code: string, tests: string, stdin?: string) => {
    const runner = getRunner("python");
    inflight.current += 1;
    setStatus(runner.isReady?.() ? "running" : "loading");
    try {
      const response = await runner.run({ language: "python", code, tests, stdin });
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

  return { status, result, loadDetail, run, retry, warmed: enabled && (getRunner("python").isWarmed?.() ?? false) };
}

export function PythonRunFeedback({
  status,
  loadDetail,
  warmed,
  onRetry,
}: {
  status: PythonRunStatus;
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
    </>
  );
}

export function CodeWidget({ id, exercise, setAction, onGrade, locked }: WidgetProps<ExerciseOf<"code">>) {
  const lessonId = useLessonId();
  const { configured, ready, user } = useAuth();
  const python = exercise.language === "python";
  const [code, setCode] = useState(exercise.starter);
  const [stdin, setStdin] = useState("");
  const [hints, setHints] = useState(0);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [submitResult, setSubmitResult] = useState<RunResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cppBusy, setCppBusy] = useState<"run" | "submit" | null>(null);
  const [phase, setPhase] = useState<"run" | "submit" | null>(null);
  const session = usePythonSession(python);
  const pythonBusy = session.status === "loading" || session.status === "running";
  const busy = python ? pythonBusy : cppBusy !== null;
  const needsSignIn = !python && configured && ready && !user;
  const noAccount = !python && !configured;
  const blocked = locked || needsSignIn || noAccount || (!python && configured && !ready);

  const execute = async (kind: "samples" | "stdin" | "submit") => {
    setNotice(null);
    if (python) {
      if (session.status === "load-error") {
        await session.retry();
        return null;
      }
      setPhase(kind === "submit" ? "submit" : "run");
      try {
        if (kind === "submit") return await session.run(code, exercise.tests);
        if (kind === "samples") return await session.run(code, exercise.visibleTests ?? "");
        return await session.run(code, "", stdin);
      } finally {
        setPhase(null);
      }
    }
    setCppBusy(kind === "submit" ? "submit" : "run");
    try {
      const response = await requestCpp({
        action: kind === "submit" ? "submit" : "run",
        runKind: kind === "submit" ? undefined : kind,
        code,
        lessonId,
        exerciseId: id,
        stdin: kind === "stdin" ? stdin : undefined,
      });
      if (!response.ok) {
        setNotice(response.message);
        return null;
      }
      return response.result;
    } finally {
      setCppBusy(null);
    }
  };

  usePrimaryAction(
    setAction,
    locked
      ? null
      : {
          label: python
            ? phase === "submit"
              ? "Submitting…"
              : pythonActionLabel(session.status === "running" ? "idle" : session.status)
            : cppBusy === "submit"
              ? "Submitting…"
              : "Submit",
          busy: python ? phase === "submit" || session.status === "loading" : cppBusy === "submit",
          disabled: blocked || busy,
          onPress: async () => {
            const result = await execute("submit");
            if (!result || result.failure === "load") return;
            setSubmitResult(result);
            const grade = gradeTests(result.tests, result.error);
            if (grade.correct) onGrade({ correct: true, message: `${grade.message} ${exercise.explanation}` });
          },
        },
  );

  const runSamples = async () => {
    const result = await execute("samples");
    if (result && result.failure !== "load") setRunResult(result);
  };
  const runInput = async () => {
    const result = await execute("stdin");
    if (result && result.failure !== "load") setRunResult(result);
  };

  return (
    <div>
      <p className="mb-1 font-display text-sm tracking-widest text-gold-ink">
        {python ? "PYTHON · RUNS IN YOUR BROWSER" : "C++ · COMPILES ON THE SERVER"}
      </p>
      <Prompt text={exercise.prompt} />
      <CodeEditor value={code} onChange={setCode} disabled={locked} label={python ? "Python code editor" : "C++ code editor"} language={exercise.language} />
      <div className="mt-2 flex flex-wrap gap-2">
        {exercise.visibleTests && (
          <Button type="button" className="min-h-11" onClick={() => void runSamples()} disabled={blocked || busy} data-testid="run-samples">
            {phase === "run" || cppBusy === "run" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Run samples
          </Button>
        )}
        <Button type="button" variant="secondary" className="min-h-11" onClick={() => void runInput()} disabled={blocked || busy} data-testid="run-code">
          Run input
        </Button>
        <Button variant="ghost" size="sm" className="min-h-11" onClick={() => setCode(exercise.starter)} disabled={locked}>
          <RotateCcw className="size-4" /> Reset code
        </Button>
        {hints < exercise.hints.length && !locked && (
          <Button variant="ghost" size="sm" className="min-h-11" onClick={() => setHints((shown) => shown + 1)}>
            <Lightbulb className="size-4" /> Hint {hints + 1}/{exercise.hints.length}
          </Button>
        )}
      </div>
      <label className="mt-3 block text-sm text-muted-foreground">
        Custom input
        <textarea
          value={stdin}
          onChange={(event) => setStdin(event.target.value)}
          disabled={locked}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          rows={3}
          placeholder="stdin for Run input. Nothing is saved."
          className="mt-1 w-full resize-y rounded-lg border-2 border-border bg-ink px-3 py-2 font-mono text-base text-foreground outline-none focus:border-gold"
          data-testid="custom-stdin"
        />
      </label>
      <p className="mt-2 text-sm text-muted-foreground">Run checks samples or this input and does not save progress. Submit runs the hidden tests.</p>
      {exercise.visibleTests && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-muted-foreground">Sample tests</summary>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-sm text-foreground">{exercise.visibleTests}</pre>
        </details>
      )}
      {hints > 0 && (
        <ul className="mt-2 space-y-1 rounded-lg border border-border bg-ink p-3 text-base">
          {exercise.hints.slice(0, hints).map((hint) => (
            <li key={hint}>
              <Lightbulb className="mr-1 inline size-4 text-gold-ink" aria-hidden />
              {hint}
            </li>
          ))}
        </ul>
      )}
      {noAccount && (
        <p role="status" data-testid="cpp-unavailable" className="mt-3 rounded-lg border-2 border-gold bg-ink p-3 text-base">
          C++ compiles on a server sandbox, and this copy of Gnosis has no sign-in configured, so Run and Submit are unavailable.
        </p>
      )}
      {needsSignIn && (
        <p role="status" data-testid="cpp-sign-in" className="mt-3 rounded-lg border-2 border-gold bg-ink p-3 text-base">
          Sign in to compile C++. The compiler runs on the server for your account, with a daily cap.
        </p>
      )}
      {notice && (
        <p role="alert" data-testid="cpp-unavailable" className="mt-3 whitespace-pre-wrap rounded-lg border-2 border-gold bg-ink p-3 text-base">
          {notice}
        </p>
      )}
      {python && (
        <PythonRunFeedback status={session.status} loadDetail={session.loadDetail} warmed={session.warmed} onRetry={() => void session.retry()} />
      )}
      {runResult && runResult.failure !== "load" && session.status !== "load-error" && (
        <div className="mt-3" data-testid="run-report">
          <p className="mb-2 text-sm font-bold tracking-widest text-muted-foreground uppercase">Sample run · nothing is saved</p>
          <TestReport result={runResult} scoreTestId="run-score" />
        </div>
      )}
      {submitResult && submitResult.failure !== "load" && session.status !== "load-error" && (
        <div className="mt-3" data-testid="test-report">
          <TestReport result={submitResult} />
        </div>
      )}
    </div>
  );
}
