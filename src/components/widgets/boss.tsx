"use client";

import { useCallback, useEffect, useState } from "react";
import { Heart, Skull, Timer } from "lucide-react";
import type { BossPart, ExerciseOf } from "@/lib/content/schema";
import { bossAnswer, bossTimeout, initialBoss, type BossState, type Grade } from "@/lib/grading";
import { cn } from "@/lib/utils";
import { FillWidget } from "./fill";
import { InlineText } from "./inline-text";
import { McqWidget } from "./mcq";
import { OrderingWidget } from "./ordering";
import { PredictWidget } from "./predict";
import type { PrimaryAction, WidgetProps } from "./types";
import { usePrimaryAction } from "./useAction";

function Part(props: WidgetProps<BossPart>) {
  const { exercise } = props;
  switch (exercise.type) {
    case "mcq":
      return <McqWidget {...props} exercise={exercise} />;
    case "fill":
      return <FillWidget {...props} exercise={exercise} />;
    case "ordering":
      return <OrderingWidget {...props} exercise={exercise} />;
    case "predict":
      return <PredictWidget {...props} exercise={exercise} />;
  }
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

export function BossWidget({ id, exercise, device, setAction, onGrade, locked }: WidgetProps<ExerciseOf<"boss">>) {
  const total = exercise.parts.length;
  const [phase, setPhase] = useState<"briefing" | "fight" | "feedback" | "over">("briefing");
  const [state, setState] = useState<BossState>(() => initialBoss(total, exercise.playerHp));
  const [timeLeft, setTimeLeft] = useState(exercise.timeLimit);
  const [last, setLast] = useState<Grade | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [hurt, setHurt] = useState(false);
  const [partAction, setPartAction] = useState<PrimaryAction | null>(null);

  useEffect(() => {
    if (phase !== "fight") return;
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === "fight" && timeLeft <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState((s) => bossTimeout(s));
      setPhase("over");
    }
  }, [timeLeft, phase]);

  const onPartGrade = useCallback(
    (g: Grade) => {
      setLast(g);
      setState((s) => bossAnswer(s, g.correct, total));
      if (!g.correct) {
        setHurt(true);
        setTimeout(() => setHurt(false), 350);
      }
      setPhase("feedback");
    },
    [total],
  );

  const advance = () => {
    if (state.status !== "fighting") {
      setPhase("over");
      return;
    }
    setAttempt((a) => a + 1);
    setPhase("fight");
  };

  const finish = () => {
    if (state.status === "won")
      onGrade({ correct: true, message: `Boss down with ${state.playerHp} heart${state.playerHp === 1 ? "" : "s"} and ${mmss(timeLeft)} to spare. ${exercise.explanation}` });
    else
      onGrade({
        correct: false,
        message: state.reason === "time" ? "Out of time. The boss got away. Run it back." : "Out of hearts. Regroup and run it back.",
      });
  };

  const action: PrimaryAction | null = locked
    ? null
    : phase === "briefing"
      ? { label: "Start the fight", onPress: () => setPhase("fight") }
      : phase === "feedback"
        ? { label: state.status === "fighting" ? (last?.correct ? "Next hit" : "Try again") : "See result", onPress: advance }
        : phase === "over"
          ? { label: state.status === "won" ? "Claim the win" : "Accept defeat", onPress: finish }
          : partAction;
  usePrimaryAction(setAction, action);

  const bossFrac = state.bossHp / total;
  const shownIndex = Math.min(phase === "feedback" && last?.correct ? state.part - 1 : state.part, total - 1);

  return (
    <div className={cn(hurt && "shake")}>
      <div className="mb-4 rounded-lg border-2 border-danger/60 bg-ink p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-display text-xl tracking-wide text-foreground">
            <Skull className="size-5 text-danger" aria-hidden /> {exercise.title.toUpperCase()}
          </p>
          <p className={cn("flex items-center gap-1 font-display text-xl tabular-nums", timeLeft <= 20 ? "text-danger" : "text-gold-ink")} aria-label={`Time left ${mmss(timeLeft)}`} data-testid="boss-timer">
            <Timer className="size-5" aria-hidden /> {mmss(timeLeft)}
          </p>
        </div>
        <div className="h-4 overflow-hidden rounded bg-panel-2" role="progressbar" aria-label="Boss health" aria-valuemin={0} aria-valuemax={total} aria-valuenow={state.bossHp}>
          <div className="h-full bg-danger transition-[width] duration-300" style={{ width: `${bossFrac * 100}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Boss HP {state.bossHp}/{total}
          </span>
          <span className="flex items-center gap-1" aria-label={`${state.playerHp} hearts left`}>
            {Array.from({ length: exercise.playerHp }, (_, i) => (
              <Heart key={i} className={cn("size-5", i < state.playerHp ? "fill-danger text-danger" : "text-muted-foreground/50")} aria-hidden />
            ))}
          </span>
        </div>
      </div>

      {phase === "briefing" && (
        <div className="rounded-lg border border-border bg-ink p-4">
          <p className="mb-2 font-display text-lg tracking-wide text-gold-ink">MISSION BRIEFING</p>
          <p className="text-base text-foreground">
            <InlineText text={exercise.briefing} />
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {total} parts · {exercise.playerHp} hearts · {mmss(exercise.timeLimit)} on the clock. The timer pauses while you read feedback.
          </p>
        </div>
      )}

      {(phase === "fight" || phase === "feedback") && (
        <div>
          <p className="mb-2 text-sm text-muted-foreground">
            Part {shownIndex + 1} of {total}
          </p>
          <Part
            key={`${shownIndex}-${attempt}`}
            id={`${id}-p${shownIndex}`}
            exercise={exercise.parts[shownIndex]}
            device={device}
            setAction={setPartAction}
            onGrade={onPartGrade}
            locked={phase === "feedback"}
          />
          {phase === "feedback" && last && (
            <p
              className={cn("mt-4 rounded-lg border-2 bg-ink p-3 text-base", last.correct ? "border-money" : "border-danger")}
              role="status"
            >
              <strong className={cn("mr-1 font-display tracking-wide", last.correct ? "text-money-ink" : "text-danger")}>
                {last.correct ? "HIT!" : "OUCH, −1 HEART."}
              </strong>
              {last.message}
            </p>
          )}
        </div>
      )}

      {phase === "over" && (
        <div className={cn("rounded-lg border-2 bg-ink p-5 text-center", state.status === "won" ? "border-money" : "border-danger")} data-testid="boss-result">
          <p className={cn("font-display text-4xl tracking-wide", state.status === "won" ? "text-gold-ink" : "text-danger")}>
            {state.status === "won" ? "BOSS DOWN" : "WASTED"}
          </p>
          <p className="mt-2 text-base text-foreground">
            {state.status === "won"
              ? `${state.playerHp} heart${state.playerHp === 1 ? "" : "s"} left · ${mmss(timeLeft)} remaining`
              : state.reason === "time"
                ? "The clock ran out."
                : "No hearts left."}
          </p>
        </div>
      )}
    </div>
  );
}
