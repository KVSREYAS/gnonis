export type CourseDownloadRecord = {
  slug: string;
  title: string;
  /** Bytes stored for this course, not the shared app shell. */
  bytes: number;
  savedAt: string;
  pages: number;
};

const DB_NAME = "gnosis-offline";
const STORE = "courses";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "slug" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Couldn't open offline storage"));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline storage failed"));
  });
}

export async function readCourseRecord(slug: string): Promise<CourseDownloadRecord | null> {
  const db = await openDb();
  try {
    const row = await requestToPromise(db.transaction(STORE).objectStore(STORE).get(slug));
    return (row as CourseDownloadRecord | undefined) ?? null;
  } finally {
    db.close();
  }
}

export async function writeCourseRecord(record: CourseDownloadRecord): Promise<void> {
  const db = await openDb();
  try {
    await requestToPromise(db.transaction(STORE, "readwrite").objectStore(STORE).put(record));
  } finally {
    db.close();
  }
}

export async function deleteCourseRecord(slug: string): Promise<void> {
  const db = await openDb();
  try {
    await requestToPromise(db.transaction(STORE, "readwrite").objectStore(STORE).delete(slug));
  } finally {
    db.close();
  }
}

export function notifyOfflineCatalog() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("gnosis-offline"));
  try {
    const channel = new BroadcastChannel("gnosis-offline");
    channel.postMessage("changed");
    channel.close();
  } catch {
    /* private mode, or a browser without BroadcastChannel */
  }
}
