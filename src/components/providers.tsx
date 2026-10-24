"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Device } from "@/lib/content/schema";
import {
  completeLesson as completeLessonPure,
  dayKey,
  emptyProgress,
  liveStreak,
  recordExercise as recordExercisePure,
  type CompletionInput,
  type CompletionResult,
  type ProgressState,
} from "@/lib/progress/logic";
import { LocalProgressStore, type ProgressStore } from "@/lib/progress/store";
import { applySettingsToDocument, DEFAULT_SETTINGS, parseSettings, PHONE_QUERY, SETTINGS_KEY, type Settings } from "@/lib/settings";

/* ---------------- Settings ---------------- */

type SettingsCtx = { settings: Settings; update: (patch: Partial<Settings>) => void };
const SettingsContext = createContext<SettingsCtx>({ settings: DEFAULT_SETTINGS, update: () => {} });

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    // Hydrate from storage once mounted; the boot script already applied it to <html>.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(parseSettings(localStorage.getItem(SETTINGS_KEY)));
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        /* private mode */
      }
      applySettingsToDocument(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);

/** "phone" on small or touch-first screens unless the user forced a mode in settings. */
export function useDevice(): Device {
  const { settings } = useSettings();
  const isPhone = useMedia(PHONE_QUERY);
  if (settings.device !== "auto") return settings.device;
  return isPhone ? "phone" : "desktop";
}

export function useReducedMotion(): boolean {
  const { settings } = useSettings();
  const system = useMedia("(prefers-reduced-motion: reduce)");
  if (settings.motion === "reduced") return true;
  if (settings.motion === "full") return false;
  return system;
}

/* ---------------- Progress ---------------- */

type ProgressCtx = {
  state: ProgressState;
  loaded: boolean;
  streakDays: number;
  recordExercise: (key: string, correct: boolean) => void;
  completeLesson: (input: Omit<CompletionInput, "now">) => CompletionResult;
  reset: () => void;
};

const ProgressContext = createContext<ProgressCtx | null>(null);

function ProgressProvider({ children, store }: { children: React.ReactNode; store?: ProgressStore }) {
  const storeRef = useRef<ProgressStore>(store ?? new LocalProgressStore());
  const [state, setState] = useState<ProgressState>(emptyProgress);
  const [loaded, setLoaded] = useState(false);
  const stateRef = useRef(state);

  const commit = useCallback((next: ProgressState) => {
    stateRef.current = next;
    setState(next);
    void storeRef.current.save(next);
  }, []);

  useEffect(() => {
    let alive = true;
    storeRef.current.load().then((s) => {
      if (!alive) return;
      stateRef.current = s;
      setState(s);
      setLoaded(true);
    });
    const unsub = storeRef.current.subscribe?.((s) => {
      stateRef.current = s;
      setState(s);
    });
    return () => {
      alive = false;
      unsub?.();
    };
  }, []);

  const recordExercise = useCallback(
    (key: string, correct: boolean) => commit(recordExercisePure(stateRef.current, key, correct)),
    [commit],
  );

  const completeLesson = useCallback(
    (input: Omit<CompletionInput, "now">) => {
      const result = completeLessonPure(stateRef.current, { ...input, now: new Date() });
      commit(result.state);
      return result;
    },
    [commit],
  );

  const reset = useCallback(() => {
    void storeRef.current.clear();
    commit(emptyProgress());
  }, [commit]);

  const streakDays = loaded ? liveStreak(state.streak, dayKey(new Date())) : 0;

  const value = useMemo(
    () => ({ state, loaded, streakDays, recordExercise, completeLesson, reset }),
    [state, loaded, streakDays, recordExercise, completeLesson, reset],
  );
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used inside <Providers>");
  return ctx;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <ProgressProvider>{children}</ProgressProvider>
    </SettingsProvider>
  );
}
