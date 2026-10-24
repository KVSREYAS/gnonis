import { emptyProgress, migrate, type ProgressState } from "./logic";

/**
 * Persistence boundary for progress. The app only talks to this interface: guests use
 * `LocalProgressStore`, signed-in users `SupabaseProgressStore` (see ./supabase-store.ts).
 */
export interface ProgressStore {
  load(): Promise<ProgressState>;
  save(state: ProgressState): Promise<void>;
  clear(): Promise<void>;
  /** Fires when progress changes outside this tab/session. Returns an unsubscribe function. */
  subscribe?(onChange: (state: ProgressState) => void): () => void;
  /** Pushes anything not yet persisted remotely. Local-only stores have nothing to flush. */
  flush?(): Promise<void>;
}

export const PROGRESS_KEY = "inference-academy:progress:v1";

type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export class LocalProgressStore implements ProgressStore {
  constructor(
    private readonly storage: KV | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
    private readonly key = PROGRESS_KEY,
  ) {}

  async load(): Promise<ProgressState> {
    try {
      const raw = this.storage?.getItem(this.key);
      return raw ? migrate(JSON.parse(raw)) : emptyProgress();
    } catch {
      return emptyProgress();
    }
  }

  async save(state: ProgressState): Promise<void> {
    try {
      this.storage?.setItem(this.key, JSON.stringify(state));
    } catch {
      // Quota or private mode: progress stays in memory for this session.
    }
  }

  async clear(): Promise<void> {
    this.storage?.removeItem(this.key);
  }

  subscribe(onChange: (state: ProgressState) => void) {
    if (typeof window === "undefined") return () => {};
    const handler = (e: StorageEvent) => {
      if (e.key !== this.key) return;
      try {
        onChange(e.newValue ? migrate(JSON.parse(e.newValue)) : emptyProgress());
      } catch {
        /* ignore malformed writes */
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }
}

export class MemoryProgressStore implements ProgressStore {
  private state: ProgressState;
  constructor(initial: ProgressState = emptyProgress()) {
    this.state = initial;
  }
  async load() {
    return structuredClone(this.state);
  }
  async save(state: ProgressState) {
    this.state = structuredClone(state);
  }
  async clear() {
    this.state = emptyProgress();
  }
}
