"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, CheckCircle2, MessagesSquare, Monitor, Smartphone, X, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AskSelection, readLessonSelection } from "@/components/lesson/ask-selection";
import { useAuth, useDevice, useProgress } from "@/components/providers";
import { exerciseBrief, exerciseTitle } from "@/lib/chat/context";
import { DIVE_PANEL_STORAGE_KEY, resolveDivePanelOpen, parseDivePanelChoice } from "@/lib/chat/dive-panel";
import { PHONE_QUERY } from "@/lib/settings";
import { studyLinks } from "@/lib/chat/prompt";
import { Radar } from "@/components/viz";
import { LessonIdProvider } from "@/components/lesson/lesson-context";
import { ExerciseRenderer, exerciseLabel } from "@/exercises/renderer";
import type { PrimaryAction } from "@/components/widgets/types";
import { MissionPassed } from "@/components/lesson/mission-passed";
import type { Exercise } from "@/lib/content/schema";
import { exerciseKey, supports } from "@/lib/content/types";
import type { Grade } from "@/lib/grading";
import { cn } from "@/lib/utils";

const DivePanel = dynamic(() => import("@/components/lesson/dive-panel").then((mod) => mod.DivePanel), { ssr: false });

export type PlayerStep = { kind: "card"; title: string; content: ReactNode; text: string } | { kind: "exercise"; id: string; exercise: Exercise };

type Quote = { id: string; text: string };

export type PlayerLesson = {
  key: string;
  courseTitle: string;
  title: string;
  kind: "lesson" | "boss";
  xp: number;
  keyIdeas: string[];
  district: string;
  moduleIndex: number;
  lessonIndex: number;
  lessonCount: number;
  hashes: Record<string, string>;
  preview?: boolean;
};

type Status = { grade: Grade | null; attempt: number; skipped?: boolean };

export function DesktopBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1 border-gold/60 font-bold text-gold-ink", className)}>
      <Monitor className="size-3.5" aria-hidden /> Desktop mission
    </Badge>
  );
}

function DeviceBadges({ ex }: { ex: Exercise }) {
  if (!supports(ex, "phone")) return <DesktopBadge />;
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <Smartphone className="size-3.5" aria-hidden /> Phone OK
    </Badge>
  );
}

export function LessonPlayer({
  lesson,
  steps,
  nextHref,
  nextLabel,
  mapHref,
  chatEnabled = false,
  defaultModel = "",
}: {
  lesson: PlayerLesson;
  steps: PlayerStep[];
  nextHref: string;
  nextLabel: string;
  mapHref: string;
  /** True when the server has an OpenRouter key. The key itself never reaches the browser. */
  chatEnabled?: boolean;
  defaultModel?: string;
}) {
  const device = useDevice();
  const { configured, user } = useAuth();
  const pathname = usePathname();
  const { state, recordExercise, noteExerciseHash, completeLesson } = useProgress();
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<"chat" | "calc">("chat");
  const [calcFocus, setCalcFocus] = useState(0);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [draft, setDraft] = useState("");
  const [latestQuestion, setLatestQuestion] = useState("");
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [widgetAction, setWidgetAction] = useState<PrimaryAction | null>(null);
  const [mission, setMission] = useState<null | { xpGained: number; firstCompletion: boolean; pending: number; preview?: boolean }>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const step = steps[index];
  const exerciseIds = useMemo(() => steps.flatMap((s) => (s.kind === "exercise" ? [s.id] : [])), [steps]);
  const st = step.kind === "exercise" ? (status[step.id] ?? { grade: null, attempt: 0 }) : null;
  const blocked = step.kind === "exercise" && !supports(step.exercise, device);
  const savedHash = step.kind === "exercise" ? state.exercises[exerciseKey(lesson.key, step.id)]?.contentHash : undefined;
  const updated = step.kind === "exercise" && !!savedHash && !!lesson.hashes[step.id] && savedHash !== lesson.hashes[step.id];

  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" });
    topRef.current?.focus({ preventScroll: true });
  }, [index]);

  const finish = useCallback(
    (latest: Record<string, Status>) => {
      const pendingDesktop = exerciseIds.filter((id) => latest[id]?.skipped).map((id) => exerciseKey(lesson.key, id));
      if (lesson.preview) {
        setMission({ xpGained: 0, firstCompletion: false, pending: pendingDesktop.length, preview: true });
        return;
      }
      const r = completeLesson({
        lessonKey: lesson.key,
        baseXp: lesson.xp,
        exerciseKeys: exerciseIds.map((id) => exerciseKey(lesson.key, id)),
        pendingDesktop,
      });
      setMission({ xpGained: r.xpGained, firstCompletion: r.firstCompletion, pending: pendingDesktop.length });
    },
    [completeLesson, exerciseIds, lesson.key, lesson.preview, lesson.xp],
  );

  const next = useCallback(
    (latest = status) => {
      if (index < steps.length - 1) setIndex(index + 1);
      else finish(latest);
    },
    [finish, index, status, steps.length],
  );

  const onGrade = useCallback(
    (g: Grade) => {
      if (step.kind !== "exercise") return;
      if (!lesson.preview) recordExercise(exerciseKey(lesson.key, step.id), g.correct, lesson.hashes[step.id]);
      setStatus((s) => ({ ...s, [step.id]: { ...(s[step.id] ?? { attempt: 0 }), grade: g } }));
    },
    [lesson.hashes, lesson.key, lesson.preview, recordExercise, step],
  );

  useEffect(() => {
    if (lesson.preview || step.kind !== "exercise") return;
    const hash = lesson.hashes[step.id];
    if (hash) noteExerciseHash(exerciseKey(lesson.key, step.id), hash);
  }, [lesson.hashes, lesson.key, lesson.preview, noteExerciseHash, step]);

  const retry = () => {
    if (step.kind !== "exercise") return;
    setStatus((s) => ({ ...s, [step.id]: { grade: null, attempt: (s[step.id]?.attempt ?? 0) + 1 } }));
  };

  const skipDesktop = () => {
    if (step.kind !== "exercise") return;
    const latest = { ...status, [step.id]: { grade: null, attempt: 0, skipped: true } };
    setStatus(latest);
    next(latest);
  };

  let primary: PrimaryAction | null;
  let secondary: { label: string; onPress: () => void } | null = null;
  const isLast = index === steps.length - 1;
  const continueLabel = isLast ? "Finish mission" : "Continue";

  if (step.kind === "card") primary = { label: continueLabel, onPress: () => next() };
  else if (blocked) primary = { label: isLast ? "Skip and finish" : "Skip for now", onPress: skipDesktop };
  else if (st?.grade?.correct) primary = { label: continueLabel, onPress: () => next() };
  else if (st?.grade) {
    primary = { label: "Try again", onPress: retry };
    secondary = { label: isLast ? "Finish anyway" : "Move on", onPress: () => next() };
  } else if (lesson.preview) {
    primary = widgetAction;
    secondary = { label: "Skip", onPress: () => next() };
  } else primary = widgetAction;

  const progress = index;
  const stepTitle = step.kind === "card" ? step.title : exerciseTitle(step.exercise);
  const stepText = step.kind === "card" ? step.text : exerciseBrief(step.exercise);
  const tutorContext = {
    courseTitle: lesson.courseTitle,
    lessonTitle: lesson.title,
    district: lesson.district,
    stepTitle,
    stepKind: step.kind,
    stepText,
    exerciseUnanswered: step.kind === "exercise" && !st?.grade?.correct,
  };
  const loginHref = `/login?next=${encodeURIComponent(pathname || mapHref)}`;

  const addQuote = useCallback((text: string) => {
    const trimmed = text.replace(/\s+/g, " ").trim().slice(0, 500);
    if (trimmed.length < 2) return;
    setQuotes((prev) => (prev.some((quote) => quote.text === trimmed) || prev.length >= 6 ? prev : [...prev, { id: crypto.randomUUID(), text: trimmed }]));
  }, []);

  const rememberQuestion = useCallback((question: string) => {
    setLatestQuestion((prev) => (prev === question ? prev : question));
  }, []);

  const panelRef = useRef(false);
  const rememberDive = useCallback((open: boolean) => {
    if (panelRef.current === open) return;
    panelRef.current = open;
    if (typeof document !== "undefined") document.documentElement.dataset.divePanel = open ? "open" : "closed";
    try {
      localStorage.setItem(DIVE_PANEL_STORAGE_KEY, open ? "open" : "closed");
    } catch {
      /* private mode */
    }
    setPanelOpen(open);
  }, []);

  useLayoutEffect(() => {
    // Match the boot script before paint. SSR stays closed so hydration does not mismatch.
    if (!chatEnabled) {
      panelRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPanelOpen(false);
      return;
    }
    const choice = parseDivePanelChoice(localStorage.getItem(DIVE_PANEL_STORAGE_KEY));
    const layout = document.documentElement.dataset.diveLayout;
    const phone = layout === "sheet" || (layout !== "drawer" && window.matchMedia(PHONE_QUERY).matches);
    const open = resolveDivePanelOpen({ chatEnabled, phone, choice });
    document.documentElement.dataset.divePanel = open ? "open" : "closed";
    if (!layout) document.documentElement.dataset.diveLayout = phone ? "sheet" : "drawer";
    panelRef.current = open;
    setPanelOpen(open);
  }, [chatEnabled]);

  const openChat = useCallback(() => {
    setPanelTab("chat");
    rememberDive(true);
  }, [rememberDive]);

  useEffect(() => {
    if (!chatEnabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        rememberDive(false);
        return;
      }
      const meta = event.metaKey || event.ctrlKey;
      if (!meta || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "k" && event.shiftKey) {
        event.preventDefault();
        setPanelTab("calc");
        rememberDive(true);
        setCalcFocus((n) => n + 1);
        return;
      }
      if (device === "phone" || key !== "l" || event.shiftKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      const found = readLessonSelection();
      if (found) addQuote(found.text);
      setPanelTab("chat");
      rememberDive(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addQuote, chatEnabled, device, rememberDive]);

  const chatgptFor = useCallback(
    (text: string) =>
      studyLinks({
        courseTitle: lesson.courseTitle,
        lessonTitle: lesson.title,
        stepTitle,
        content: stepText,
        selections: [...quotes.map((quote) => quote.text), text],
        question: draft.trim() || latestQuestion,
      }).chatgpt,
    [draft, latestQuestion, lesson.courseTitle, lesson.title, quotes, stepText, stepTitle],
  );

  return (
    <LessonIdProvider id={lesson.key}>
    <div
      className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-3 sm:px-6"
      data-lesson-player
      data-chat-enabled={chatEnabled ? "true" : "false"}
    >
      {lesson.preview && (
        <p className="mt-3 rounded-lg border border-gold bg-ink px-3 py-2 text-center text-sm font-bold tracking-widest text-gold-ink uppercase" data-testid="preview-banner">
          Preview · progress is not saved
        </p>
      )}
      <div ref={topRef} tabIndex={-1} className="flex scroll-mt-16 items-center gap-3 pt-4 pb-3 outline-none sm:pt-6">
        <Link href={mapHref} className="tap -ml-2 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground" aria-label="Quit to map">
          <X className="size-6" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold tracking-widest text-gold-ink uppercase">
            District {String(lesson.moduleIndex).padStart(2, "0")} · {lesson.district}
          </p>
          <h1 className="truncate font-display text-2xl leading-tight tracking-wide text-foreground sm:text-3xl">
            {lesson.kind === "boss" ? lesson.title.toUpperCase() : lesson.title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {chatEnabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 border-gold/60 px-2 text-gold-ink sm:px-3"
              aria-expanded={panelOpen}
              aria-controls="dive-panel"
              aria-label="Dive deeper"
              data-testid="dive-toggle"
              onClick={() => {
                setPanelTab("chat");
                rememberDive(!panelOpen);
              }}
            >
              <MessagesSquare />
              <span className="max-sm:sr-only">Dive deeper</span>
            </Button>
          )}
          <span className="hidden text-sm text-muted-foreground sm:inline" aria-hidden>
            {progress + 1}/{steps.length}
          </span>
          <Radar value={progress + 1} total={steps.length} />
        </div>
      </div>
      <div className="mb-4 flex gap-1" aria-hidden>
        {steps.map((s, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i < index ? "bg-money" : i === index ? "bg-gold" : "bg-panel-2",
              s.kind === "exercise" && "h-2.5",
            )}
          />
        ))}
      </div>

      <section className="flex-1 pb-40" aria-live="polite" data-lesson-content>
        {step.kind === "card" ? (
          <article className="mx-auto max-w-[68ch] rounded-xl border border-border bg-panel p-5 sm:p-8" data-testid="lesson-card">
            <h2 className="mb-4 font-display text-3xl leading-tight tracking-wide text-foreground">{step.title}</h2>
            <div className="reading">{step.content}</div>
          </article>
        ) : (
          <article className="rounded-xl border border-border bg-panel p-4 sm:p-7" data-testid="lesson-exercise" data-exercise-type={step.exercise.type}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="font-display text-lg tracking-widest text-gold-ink">{exerciseLabel(step.exercise.type).toUpperCase()}</span>
              <DeviceBadges ex={step.exercise} />
              {updated && (
                <Badge className="bg-gold text-ink" data-testid="exercise-updated">
                  Updated
                </Badge>
              )}
            </div>
            {blocked ? (
              <div className="rounded-lg border-2 border-dashed border-gold/60 bg-ink p-5" data-testid="desktop-mission">
                <DesktopBadge className="mb-3" />
                <p className="text-lg font-bold text-foreground">This one needs a keyboard.</p>
                <p className="mt-1 text-base text-muted-foreground">
                  Code puzzles are desktop missions. Skip it for now. It will be marked on your map, and you can collect the bonus later on a computer.
                </p>
              </div>
            ) : (
              <ExerciseRenderer
                key={`${step.id}-${st?.attempt ?? 0}`}
                id={step.id}
                exercise={step.exercise}
                device={device}
                setAction={setWidgetAction}
                onGrade={onGrade}
                locked={!!st?.grade}
              />
            )}
            {st?.grade && (
              <div
                role="status"
                data-testid="feedback"
                data-correct={st.grade.correct}
                className={cn("mt-5 flex gap-3 rounded-lg border-2 bg-ink p-4", st.grade.correct ? "border-money" : "border-danger")}
              >
                {st.grade.correct ? (
                  <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-money-ink" aria-hidden />
                ) : (
                  <XCircle className="mt-0.5 size-6 shrink-0 text-danger" aria-hidden />
                )}
                <div>
                  <p className={cn("font-display text-xl tracking-wide", st.grade.correct ? "text-money-ink" : "text-danger")}>
                    {st.grade.correct ? "NICE WORK" : "NOT QUITE"}
                  </p>
                  <p className="mt-1 text-base whitespace-pre-line text-foreground">{st.grade.message}</p>
                </div>
              </div>
            )}
          </article>
        )}
      </section>

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-ink/95 backdrop-blur"
        data-testid="action-bar"
      >
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            aria-label="Previous step"
            className="shrink-0"
          >
            <ArrowLeft className="size-6" />
          </Button>
          {secondary && (
            <Button variant="outline" size="lg" className="h-14 shrink-0" onClick={secondary.onPress}>
              {secondary.label}
            </Button>
          )}
          <Button
            size="lg"
            className="h-14 flex-1 font-display text-xl tracking-wider"
            onClick={() => primary?.onPress()}
            disabled={!primary || primary.disabled}
            aria-busy={primary?.busy}
            data-testid="primary-action"
          >
            {primary?.label ?? "…"}
          </Button>
        </div>
      </div>

      {chatEnabled && (
        <AskSelection
          enabled
          device={device}
          chatgptHref={chatgptFor}
          onAsk={(text) => {
            addQuote(text);
            openChat();
          }}
        />
      )}
      {chatEnabled && panelOpen && (
        <DivePanel
          device={device}
          tab={panelTab}
          onTab={setPanelTab}
          onClose={() => rememberDive(false)}
          lessonKey={lesson.key}
          context={tutorContext}
          quotes={quotes}
          onRemoveQuote={(id) => setQuotes((prev) => prev.filter((quote) => quote.id !== id))}
          onClearQuotes={() => setQuotes([])}
          draft={draft}
          onDraft={setDraft}
          defaultModel={defaultModel}
          signedIn={configured && !!user}
          accountsConfigured={configured}
          loginHref={loginHref}
          latestQuestion={latestQuestion}
          onLatestQuestion={rememberQuestion}
          calcFocus={calcFocus}
        />
      )}

      {mission && (
        <MissionPassed
          title={lesson.title}
          xpGained={mission.xpGained}
          firstCompletion={mission.firstCompletion}
          pendingDesktop={mission.pending}
          preview={mission.preview}
          keyIdeas={lesson.keyIdeas}
          nextHref={nextHref}
          nextLabel={nextLabel}
          mapHref={mapHref}
        />
      )}
    </div>
    </LessonIdProvider>
  );
}
