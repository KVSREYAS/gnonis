"use client";

import { useState } from "react";
import { Bug } from "lucide-react";
import type { ExerciseOf } from "@/lib/content/schema";
import { gradeDebugLine, gradeTests } from "@/lib/grading";
import { cn } from "@/lib/utils";
import { CodeEditor, PythonRunFeedback, pythonActionLabel, useCodeRun } from "./code";
import { Prompt } from "./inline-text";
import type { WidgetProps } from "./types";
import { usePrimaryAction } from "./useAction";

function LineMode({ id, exercise, setAction, onGrade, locked }: WidgetProps<ExerciseOf<"debug">>) {
  const [line, setLine] = useState<number | null>(null);
  const lines = exercise.code.replace(/\n$/, "").split("\n");

  usePrimaryAction(setAction, locked ? null : { label: "That's the bug", disabled: line === null, onPress: () => onGrade(gradeDebugLine(exercise, line)) });

  return (
    <div role="radiogroup" aria-label="Code lines" className="overflow-x-auto rounded-lg border-2 border-border bg-ink py-2">
      {lines.map((text, i) => {
        const n = i + 1;
        const sel = line === n;
        const isBug = locked && n === exercise.bugLine;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={sel}
            aria-label={`Line ${n}: ${text.trim() || "blank"}`}
            disabled={locked || !text.trim()}
            onClick={() => setLine(n)}
            data-testid={`${id}-line-${n}`}
            className={cn(
              "flex min-h-11 w-full items-center gap-3 px-2 text-left font-mono text-sm whitespace-pre",
              sel ? "bg-gold/20 outline-2 outline-gold" : "hover:bg-panel-2",
              isBug && "bg-money/20 outline-2 outline-money",
              locked && sel && !isBug && "bg-danger/20 outline-danger",
            )}
          >
            <span className="w-6 shrink-0 text-right text-muted-foreground">{n}</span>
            <span className="text-foreground">{text || " "}</span>
          </button>
        );
      })}
    </div>
  );
}

function CodeMode({ exercise, setAction, onGrade, locked }: WidgetProps<ExerciseOf<"debug">>) {
  const [code, setCode] = useState(exercise.code);
  const { status, result, loadDetail, run, retry, warmed } = useCodeRun(exercise.tests ?? "");
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
    <>
      <CodeEditor value={code} onChange={setCode} disabled={locked} label="Buggy code, edit to fix" />
      <PythonRunFeedback status={status} result={result} loadDetail={loadDetail} warmed={warmed} onRetry={() => void retry()} />
    </>
  );
}

export function DebugWidget(props: WidgetProps<ExerciseOf<"debug">>) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 font-display text-sm tracking-widest text-gold-ink">
        <Bug className="size-4" aria-hidden /> DEBUG THIS
      </p>
      <Prompt text={props.exercise.prompt} />
      {props.exercise.mode === "line" ? <LineMode {...props} /> : <CodeMode {...props} />}
    </div>
  );
}
