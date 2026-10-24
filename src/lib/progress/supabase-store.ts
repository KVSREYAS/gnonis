import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyProgress, migrate, type ProgressState } from "./logic";
import { isEmptyProgress, mergeProgress, sameProgress } from "./merge";
import { EMPTY_RENAMES, type RenameMap } from "./rename-map";
import { PROGRESS_KEY, type ProgressStore } from "./store";

/** The two calls the store needs from the backend. Kept tiny so tests can fake it. */
export interface ProgressRemote {
  /** The saved progress, or null when this account has no row yet. */
  pull(): Promise<ProgressState | null>;
  push(state: ProgressState): Promise<void>;
}

/** `public.progress` (user_id uuid PK, data jsonb, updated_at timestamptz), protected by own-row RLS. */
export function supabaseRemote(client: SupabaseClient, userId: string, renames: RenameMap = EMPTY_RENAMES): ProgressRemote {
  return {
    async pull() {
      const { data, error } = await client.from("progress").select("data").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data ? migrate(data.data, renames) : null;
    },
    async push(state) {
      const { error } = await client
        .from("progress")
        .upsert({ user_id: userId, data: state, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
    },
  };
}

export type SyncStatus = "idle" | "syncing" | "synced" | "pending" | "offline" | "error";

type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * What is kept on the device for a signed-in user. `dirty` means there are changes the cloud has not
 * confirmed yet. `guest` holds progress made while signed out that has been claimed by this account
 * but not uploaded yet, so it survives a reload, going offline, or a reset made on another device.
 */
type Cache = { state: ProgressState; dirty: boolean; guest?: ProgressState };

export type SupabaseStoreOptions = {
  remote: ProgressRemote;
  userId: string;
  storage?: KV;
  /** Where guest (signed-out) progress lives. It is merged into the account and then removed. */
  guestKey?: string;
  debounceMs?: number;
  /** How long `load()` waits for the cloud before showing the copy on this device. */
  loadTimeoutMs?: number;
  onStatus?: (status: SyncStatus) => void;
  /** Applied when a save is read, so renamed lesson and exercise ids keep their progress. */
  renames?: RenameMap;
};

const MAX_BACKOFF_MS = 60_000;

export const userCacheKey = (userId: string) => `gnosis:progress:user:${userId}:v1`;

/**
 * Local-first progress for signed-in users. Every save lands in localStorage synchronously, then a
 * debounced sync pulls the cloud copy, merges (see `mergeProgress`), and pushes the result. Failed
 * syncs keep the local copy marked dirty and retry with backoff, when the browser comes back
 * online, and when the tab becomes visible again, so progress is never dropped.
 */
export class SupabaseProgressStore implements ProgressStore {
  private readonly remote: ProgressRemote;
  private readonly storage: KV | undefined;
  private readonly key: string;
  private readonly guestKey: string;
  private readonly debounceMs: number;
  private readonly loadTimeoutMs: number;
  private readonly onStatus?: (status: SyncStatus) => void;
  private readonly renames: RenameMap;

  private listeners = new Set<(state: ProgressState) => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | undefined;
  private rerun = false;
  private backoffMs = 0;
  private revision = 0;
  private lastEmitted: ProgressState | undefined;
  private status: SyncStatus = "idle";
  private disposed = false;
  /** In-memory mirror of the cache, so a full or blocked localStorage still keeps this session's progress. */
  private mem: Cache | undefined;

  constructor(opts: SupabaseStoreOptions) {
    this.remote = opts.remote;
    this.storage = opts.storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
    this.key = userCacheKey(opts.userId);
    this.guestKey = opts.guestKey ?? PROGRESS_KEY;
    this.debounceMs = opts.debounceMs ?? 1500;
    this.loadTimeoutMs = opts.loadTimeoutMs ?? 5000;
    this.onStatus = opts.onStatus;
    this.renames = opts.renames ?? EMPTY_RENAMES;
  }

  private readState(raw: unknown): ProgressState {
    return migrate(raw, this.renames);
  }

  async load(): Promise<ProgressState> {
    this.claimGuestProgress();
    const sync = this.sync();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([sync, new Promise<void>((r) => (timeout = setTimeout(r, this.loadTimeoutMs)))]);
    clearTimeout(timeout);
    return this.localState();
  }

  async save(state: ProgressState): Promise<void> {
    this.revision++;
    const cache = this.readCache();
    this.writeCache({ ...cache, state, dirty: true });
    this.lastEmitted = state;
    this.setStatus("pending");
    this.schedule(this.debounceMs);
  }

  /** Forgets this device's copy. The provider follows up with a reset save, whose higher epoch wins in the cloud. */
  async clear(): Promise<void> {
    this.mem = undefined;
    try {
      this.storage?.removeItem(this.key);
    } catch {
      /* private mode */
    }
  }

  /** Pushes anything pending right now, e.g. before signing out. Resolves even if the push fails. */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.readCache().dirty || this.running) await this.sync();
  }

  /**
   * Listens for cloud merges, other tabs, reconnects and the tab regaining focus. When the last
   * listener unsubscribes, pending changes are pushed once and no further retries are scheduled.
   */
  subscribe(onChange: (state: ProgressState) => void) {
    this.listeners.add(onChange);
    this.disposed = false;
    const detach = typeof window === "undefined" ? () => {} : this.attachWindowListeners();
    return () => {
      this.listeners.delete(onChange);
      detach();
      if (this.listeners.size > 0) return;
      this.disposed = true;
      clearTimeout(this.timer);
      this.timer = undefined;
      if (this.readCache().dirty) void this.sync();
    };
  }

  private attachWindowListeners() {
    const onOnline = () => this.schedule(0);
    const onVisible = () => {
      if (document.visibilityState === "visible") this.schedule(0);
      else if (this.readCache().dirty) void this.flush();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== this.key || !e.newValue) return;
      const incoming = this.parseCache(e.newValue);
      if (!incoming) return;
      const mine = this.readCache();
      const state = mergeProgress(mine.state, incoming.state);
      this.mem = { ...mine, state, dirty: mine.dirty || incoming.dirty };
      this.emit(state);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  /** Pull, merge, push. Concurrent calls share one run, and a call during a run triggers one more run after it. */
  sync(): Promise<void> {
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = this.runSync().finally(() => {
      this.running = undefined;
      if (this.rerun) {
        this.rerun = false;
        this.schedule(0);
      }
    });
    return this.running;
  }

  private async runSync(): Promise<void> {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.setStatus("offline");
      return;
    }
    // While retrying after a failure, keep showing the failure until a sync actually succeeds.
    if (this.status !== "error" && this.status !== "offline") this.setStatus("syncing");
    const startRevision = this.revision;
    try {
      const remote = await this.remote.pull();
      const cache = this.readCache();
      let merged = remote ? mergeProgress(remote, cache.state) : cache.state;
      if (cache.guest) merged = mergeProgress(merged, { ...cache.guest, epoch: merged.epoch });

      const needsPush = remote ? !sameProgress(merged, remote) : !isEmptyProgress(merged) || cache.dirty;
      if (needsPush) await this.remote.push(merged);

      const latest = this.readCache();
      const changedMeanwhile = this.revision !== startRevision;
      if (changedMeanwhile) merged = mergeProgress(merged, latest.state);
      this.writeCache({ state: merged, dirty: changedMeanwhile });
      this.backoffMs = 0;
      this.emit(merged);
      if (changedMeanwhile) {
        this.setStatus("pending");
        this.schedule(this.debounceMs);
      } else {
        this.setStatus("synced");
      }
    } catch {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      this.setStatus(offline ? "offline" : "error");
      this.backoffMs = Math.min(MAX_BACKOFF_MS, this.backoffMs ? this.backoffMs * 2 : 2000);
      this.schedule(this.backoffMs);
    }
  }

  /** Moves signed-out progress on this device into the account's local copy, then removes it from guest storage. */
  private claimGuestProgress() {
    let guest: ProgressState | null = null;
    try {
      const raw = this.storage?.getItem(this.guestKey);
      guest = raw ? this.readState(JSON.parse(raw)) : null;
    } catch {
      guest = null;
    }
    if (!guest || isEmptyProgress(guest)) return;
    const cache = this.readCache();
    const claimed = cache.guest ? mergeProgress(cache.guest, { ...guest, epoch: cache.guest.epoch }) : guest;
    const state = mergeProgress(cache.state, { ...claimed, epoch: cache.state.epoch });
    if (!this.writeCache({ state, dirty: true, guest: claimed })) return;
    try {
      this.storage?.removeItem(this.guestKey);
    } catch {
      /* keep it; merging it again later is harmless */
    }
  }

  private localState(): ProgressState {
    return structuredClone(this.readCache().state);
  }

  private schedule(ms: number) {
    if (this.disposed) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.sync();
    }, ms);
  }

  private emit(state: ProgressState) {
    if (this.lastEmitted && sameProgress(this.lastEmitted, state)) return;
    this.lastEmitted = state;
    for (const l of this.listeners) l(structuredClone(state));
  }

  private setStatus(status: SyncStatus) {
    if (status === this.status) return;
    this.status = status;
    this.onStatus?.(status);
  }

  private readCache(): Cache {
    if (this.mem) return this.mem;
    let cache: Cache | null = null;
    try {
      const raw = this.storage?.getItem(this.key);
      cache = raw ? this.parseCache(raw) : null;
    } catch {
      cache = null;
    }
    this.mem = cache ?? { state: emptyProgress(), dirty: false };
    return this.mem;
  }

  private parseCache(raw: string): Cache | null {
    try {
      const parsed = JSON.parse(raw) as Partial<Cache>;
      if (!parsed || typeof parsed !== "object") return null;
      return {
        state: this.readState(parsed.state),
        dirty: parsed.dirty === true,
        ...(parsed.guest ? { guest: this.readState(parsed.guest) } : {}),
      };
    } catch {
      return null;
    }
  }

  private writeCache(cache: Cache): boolean {
    this.mem = cache;
    try {
      this.storage?.setItem(this.key, JSON.stringify(cache));
      return true;
    } catch {
      return false;
    }
  }
}
