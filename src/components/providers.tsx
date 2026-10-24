"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Device } from "@/lib/content/schema";
import type { User } from "@supabase/supabase-js";
import {
  completeLesson as completeLessonPure,
  dayKey,
  emptyProgress,
  liveStreak,
  noteExerciseHash as noteExerciseHashPure,
  recordExercise as recordExercisePure,
  resetProgress,
  type CompletionInput,
  type CompletionResult,
  type ProgressState,
} from "@/lib/progress/logic";
import type { RenameMap } from "@/lib/progress/rename-map";
import { LocalProgressStore, PROGRESS_KEY, type ProgressStore } from "@/lib/progress/store";
import { SupabaseProgressStore, supabaseRemote, type SyncStatus } from "@/lib/progress/supabase-store";
import { applySettingsToDocument, DEFAULT_SETTINGS, parseSettings, PHONE_QUERY, SETTINGS_KEY, type Settings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

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

/* ---------------- Auth ---------------- */

export type AuthUser = { id: string; email: string | null; name: string };

type AuthCtx = {
  /** False when the Supabase env vars are missing: no accounts, local-only progress. */
  configured: boolean;
  /** True once the initial session is known (immediately when not configured). */
  ready: boolean;
  user: AuthUser | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({ configured: false, ready: true, user: null, signOut: async () => {} });

function fallbackName(user: User): string {
  const meta = user.user_metadata ?? {};
  const full = typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : "";
  return full.trim() || user.email?.split("@")[0] || "Player";
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<{ ready: boolean; user: User | null }>({ ready: !configured, user: null });
  const [profile, setProfile] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const client = createClient();
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((_event, s) => {
      const user = s?.user ?? null;
      setSession((prev) => (prev.ready && prev.user?.id === user?.id ? prev : { ready: true, user }));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session.user?.id;
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    createClient()
      ?.from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive && typeof data?.display_name === "string" && data.display_name.trim()) {
          setProfile({ id: userId, name: data.display_name.trim() });
        }
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const signOut = useCallback(async () => {
    await createClient()?.auth.signOut();
  }, []);

  const user = useMemo<AuthUser | null>(() => {
    const u = session.user;
    if (!u) return null;
    return { id: u.id, email: u.email ?? null, name: profile?.id === u.id ? profile.name : fallbackName(u) };
  }, [session.user, profile]);

  const value = useMemo(() => ({ configured, ready: session.ready, user, signOut }), [configured, session.ready, user, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/* ---------------- Progress ---------------- */

type ProgressCtx = {
  state: ProgressState;
  loaded: boolean;
  streakDays: number;
  /** True when progress is saved to the signed-in account rather than this device only. */
  cloud: boolean;
  syncStatus: SyncStatus;
  recordExercise: (key: string, correct: boolean, contentHash?: string) => void;
  noteExerciseHash: (key: string, contentHash: string) => void;
  completeLesson: (input: Omit<CompletionInput, "now">) => CompletionResult;
  reset: () => void;
  /** Pushes pending changes to the account, e.g. before signing out. */
  flush: () => Promise<void>;
};

const ProgressContext = createContext<ProgressCtx | null>(null);

function ProgressProvider({ children, renames }: { children: React.ReactNode; renames: RenameMap }) {
  const { ready, user } = useAuth();
  const userId = user?.id ?? null;
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");

  // Guests keep the existing localStorage store. Signed-in users get a local-first store synced to Supabase.
  const store = useMemo<ProgressStore | null>(() => {
    if (!ready) return null;
    const client = userId ? createClient() : null;
    if (!client || !userId) return new LocalProgressStore(undefined, PROGRESS_KEY, renames);
    return new SupabaseProgressStore({
      remote: supabaseRemote(client, userId, renames),
      userId,
      renames,
      onStatus: setSyncStatus,
    });
  }, [ready, userId, renames]);

  // Until auth is known, anything saved lands in guest storage, which a signed-in store then claims.
  const storeRef = useRef<ProgressStore>(new LocalProgressStore(undefined, PROGRESS_KEY, renames));
  const [state, setState] = useState<ProgressState>(emptyProgress);
  const [loaded, setLoaded] = useState(false);
  const stateRef = useRef(state);

  const commit = useCallback((next: ProgressState) => {
    stateRef.current = next;
    setState(next);
    void storeRef.current.save(next);
  }, []);

  useEffect(() => {
    if (!store) return;
    storeRef.current = store;
    let alive = true;
    store.load().then((s) => {
      if (!alive) return;
      stateRef.current = s;
      setState(s);
      setLoaded(true);
    });
    const unsub = store.subscribe?.((s) => {
      if (!alive) return;
      stateRef.current = s;
      setState(s);
    });
    return () => {
      alive = false;
      unsub?.();
    };
  }, [store]);

  const recordExercise = useCallback(
    (key: string, correct: boolean, contentHash?: string) => commit(recordExercisePure(stateRef.current, key, correct, contentHash)),
    [commit],
  );

  const noteExerciseHash = useCallback(
    (key: string, contentHash: string) => {
      const next = noteExerciseHashPure(stateRef.current, key, contentHash);
      if (next !== stateRef.current) commit(next);
    },
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
    const next = resetProgress(stateRef.current, new Date());
    void storeRef.current.clear();
    commit(next);
  }, [commit]);

  const flush = useCallback(async () => {
    await storeRef.current.flush?.();
  }, []);

  const streakDays = loaded ? liveStreak(state.streak, dayKey(new Date())) : 0;
  const cloud = !!userId;
  const status: SyncStatus = cloud ? syncStatus : "idle";

  const value = useMemo(
    () => ({ state, loaded, streakDays, cloud, syncStatus: status, recordExercise, noteExerciseHash, completeLesson, reset, flush }),
    [state, loaded, streakDays, cloud, status, recordExercise, noteExerciseHash, completeLesson, reset, flush],
  );
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used inside <Providers>");
  return ctx;
}

export function Providers({ children, renames }: { children: React.ReactNode; renames: RenameMap }) {
  return (
    <SettingsProvider>
      <AuthProvider>
        <ProgressProvider renames={renames}>{children}</ProgressProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}
