import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeLesson, emptyProgress, recordExercise, resetProgress, type ProgressState } from "@/lib/progress/logic";
import { PROGRESS_KEY } from "@/lib/progress/store";
import { SupabaseProgressStore, userCacheKey, type ProgressRemote, type SyncStatus } from "@/lib/progress/supabase-store";

const USER = "00000000-0000-0000-0000-000000000001";
const DEBOUNCE = 1000;

/** Stands in for public.progress: one row, optional failures, and a log of calls. */
class FakeRemote implements ProgressRemote {
  row: ProgressState | null = null;
  down = false;
  hang = false;
  pulls = 0;
  pushes: ProgressState[] = [];
  async pull() {
    this.pulls++;
    if (this.hang) return new Promise<never>(() => {});
    if (this.down) throw new Error("network down");
    // jsonb round trip: a copy with keys in a different order.
    return this.row ? (JSON.parse(JSON.stringify(this.row)) as ProgressState) : null;
  }
  async push(state: ProgressState) {
    if (this.down) throw new Error("network down");
    this.row = JSON.parse(JSON.stringify(state));
    this.pushes.push(this.row!);
  }
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const finished = (key: string, xp: number, now = "2026-10-22T10:00:00") =>
  completeLesson(emptyProgress(), { lessonKey: key, baseXp: xp, exerciseKeys: [], pendingDesktop: [], now: new Date(now) }).state;

function makeStore(remote: FakeRemote, storage = memoryStorage(), statuses: SyncStatus[] = []) {
  const store = new SupabaseProgressStore({
    remote,
    userId: USER,
    storage,
    debounceMs: DEBOUNCE,
    loadTimeoutMs: 3000,
    onStatus: (s) => statuses.push(s),
  });
  return { store, storage, statuses };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("SupabaseProgressStore", () => {
  it("loads an empty save for a new account without writing a row", async () => {
    const remote = new FakeRemote();
    const { store } = makeStore(remote);
    expect(await store.load()).toEqual(emptyProgress());
    expect(remote.pushes).toHaveLength(0);
  });

  it("loads the cloud copy on a new device", async () => {
    const remote = new FakeRemote();
    remote.row = finished("c/m/a", 50);
    const { store, storage } = makeStore(remote);
    expect((await store.load()).xp).toBe(50);
    expect(JSON.parse(storage.getItem(userCacheKey(USER))!).state.xp).toBe(50);
  });

  it("merges guest progress into the account on first sign-in and clears the guest save", async () => {
    const remote = new FakeRemote();
    remote.row = finished("c/m/a", 50);
    const storage = memoryStorage();
    storage.setItem(PROGRESS_KEY, JSON.stringify(finished("c/m/b", 30)));
    const { store } = makeStore(remote, storage);

    const loaded = await store.load();
    expect(Object.keys(loaded.lessons).sort()).toEqual(["c/m/a", "c/m/b"]);
    expect(loaded.xp).toBe(80);
    expect(remote.row?.xp).toBe(80);
    expect(storage.getItem(PROGRESS_KEY)).toBeNull();
  });

  it("keeps claimed guest progress when the first sync fails, and uploads it later", async () => {
    const remote = new FakeRemote();
    remote.down = true;
    const storage = memoryStorage();
    storage.setItem(PROGRESS_KEY, JSON.stringify(finished("c/m/b", 30)));
    const first = makeStore(remote, storage).store;
    expect((await first.load()).xp).toBe(30);
    expect(storage.getItem(PROGRESS_KEY)).toBeNull();

    remote.down = false;
    const reloaded = makeStore(remote, storage).store;
    expect((await reloaded.load()).xp).toBe(30);
    expect(remote.row?.xp).toBe(30);
    expect(JSON.parse(storage.getItem(userCacheKey(USER))!).dirty).toBe(false);
  });

  it("writes locally at once and debounces uploads", async () => {
    const remote = new FakeRemote();
    const { store, storage } = makeStore(remote);
    let s = await store.load();
    for (const key of ["a", "b", "c"]) {
      s = recordExercise(s, key, true);
      await store.save(s);
      expect(JSON.parse(storage.getItem(userCacheKey(USER))!).state.exercises[key]).toBeTruthy();
      await vi.advanceTimersByTimeAsync(DEBOUNCE / 2);
    }
    expect(remote.pushes).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(remote.pushes).toHaveLength(1);
    expect(Object.keys(remote.row!.exercises)).toEqual(["a", "b", "c"]);
  });

  it("keeps progress through errors and retries with backoff", async () => {
    const remote = new FakeRemote();
    const { store, storage, statuses } = makeStore(remote);
    await store.load();
    remote.down = true;
    await store.save(finished("c/m/a", 50));
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(statuses.at(-1)).toBe("error");
    expect(JSON.parse(storage.getItem(userCacheKey(USER))!)).toMatchObject({ dirty: true, state: { xp: 50 } });

    remote.down = false;
    await vi.advanceTimersByTimeAsync(2000);
    expect(remote.row?.xp).toBe(50);
    expect(statuses.at(-1)).toBe("synced");
    expect(JSON.parse(storage.getItem(userCacheKey(USER))!).dirty).toBe(false);
  });

  it("falls back to the device copy when the cloud doesn't answer", async () => {
    const storage = memoryStorage();
    storage.setItem(userCacheKey(USER), JSON.stringify({ state: finished("c/m/a", 50), dirty: true }));
    const remote = new FakeRemote();
    remote.hang = true;
    const { store } = makeStore(remote, storage);
    const pending = store.load();
    await vi.advanceTimersByTimeAsync(3000);
    expect((await pending).xp).toBe(50);
  });

  it("merges progress made on another device and notifies subscribers", async () => {
    const remote = new FakeRemote();
    const { store } = makeStore(remote);
    const seen: ProgressState[] = [];
    store.subscribe((s) => seen.push(s));
    await store.load();

    remote.row = finished("c/m/phone", 40);
    await store.save(finished("c/m/pc", 60, "2026-10-22T11:00:00"));
    await vi.advanceTimersByTimeAsync(DEBOUNCE);

    expect(remote.row!.xp).toBe(100);
    expect(Object.keys(remote.row!.lessons).sort()).toEqual(["c/m/pc", "c/m/phone"]);
    expect(seen.at(-1)?.xp).toBe(100);
  });

  it("does not lose a save made while a sync is in flight", async () => {
    const remote = new FakeRemote();
    const { store } = makeStore(remote);
    await store.load();
    await store.save(finished("c/m/a", 50));
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const push = remote.push.bind(remote);
    remote.push = async (s) => {
      await gate;
      return push(s);
    };
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    await store.save(recordExercise(finished("c/m/a", 50), "late", true));
    release();
    await vi.advanceTimersByTimeAsync(DEBOUNCE * 2);
    expect(remote.row?.exercises.late).toBeTruthy();
    expect(remote.row?.lessons["c/m/a"]).toBeTruthy();
  });

  it("makes a reset stick in the cloud", async () => {
    const remote = new FakeRemote();
    remote.row = finished("c/m/a", 50);
    const { store } = makeStore(remote);
    const loaded = await store.load();
    await store.clear();
    await store.save(resetProgress(loaded, new Date("2026-10-23T00:00:00")));
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(remote.row).toMatchObject({ xp: 0, epoch: 1, lessons: {} });
  });

  it("flush uploads pending changes immediately", async () => {
    const remote = new FakeRemote();
    const { store } = makeStore(remote);
    await store.load();
    await store.save(finished("c/m/a", 50));
    await store.flush();
    expect(remote.row?.xp).toBe(50);
  });

  it("stops retrying after the last subscriber leaves", async () => {
    const remote = new FakeRemote();
    const { store } = makeStore(remote);
    const unsubscribe = store.subscribe(() => {});
    await store.load();
    remote.down = true;
    await store.save(finished("c/m/a", 50));
    unsubscribe();
    await vi.advanceTimersByTimeAsync(0);
    const pulls = remote.pulls;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(remote.pulls).toBe(pulls);
  });
});
