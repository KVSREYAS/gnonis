import {
  COURSE_CACHE_PREFIX,
  SHELL_CACHE,
  SHELL_PATHS,
  courseCacheName,
  coursePagePaths,
  extractAssetUrls,
  responseForCache,
  shouldParseForAssets,
  type CoursePages,
} from "@/lib/offline/catalog";
import { deleteCourseRecord, notifyOfflineCatalog, writeCourseRecord, type CourseDownloadRecord } from "@/lib/offline/db";

export type DownloadProgress = { completed: number; total: number; bytes: number };

type Job = { path: string; cache: string; page: boolean };

const POOL = 4;

function decodeText(body: ArrayBuffer): string {
  return new TextDecoder().decode(body);
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>, signal?: AbortSignal): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      if (signal?.aborted) throw new DOMException("The download was cancelled.", "AbortError");
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Registers the worker that serves saved pages when a navigation can't reach the network. */
export async function ensureServiceWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("This browser can't save courses for offline use.");
  }
  if (process.env.NODE_ENV !== "production") {
    throw new Error("Offline download works in the production app. The dev server doesn't keep a service worker.");
  }
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  await navigator.serviceWorker.ready;
  if (navigator.serviceWorker.controller) return;
  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 4000);
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

async function requestPersistentStorage() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* iOS may ignore this until the app is on the Home Screen. The save still proceeds. */
  }
}

/**
 * Saves the shell (so the installed app opens) and every page of one course.
 * Assets found in those pages — scripts, styles, pictures, fonts — go in the same cache
 * as the page that referenced them. Shared shell files stay out of the course cache
 * so Remove download doesn't take the app shell with it.
 */
export async function downloadCourse(course: CoursePages & { title: string }, onProgress: (progress: DownloadProgress) => void, signal?: AbortSignal): Promise<CourseDownloadRecord> {
  await ensureServiceWorker();
  await requestPersistentStorage();
  const origin = location.origin;
  const courseCache = courseCacheName(course.slug);
  const pages = coursePagePaths(course);
  let wave: Job[] = [
    ...SHELL_PATHS.map((path) => ({ path, cache: SHELL_CACHE, page: true })),
    ...pages.map((path) => ({ path, cache: courseCache, page: true })),
  ];
  const seen = new Set(wave.map((job) => job.path));
  let completed = 0;
  let known = wave.length;
  let courseBytes = 0;
  const bins = new Map<string, Cache>();
  const cacheFor = async (name: string) => {
    let cache = bins.get(name);
    if (!cache) {
      cache = await caches.open(name);
      bins.set(name, cache);
    }
    return cache;
  };

  const report = () => onProgress({ completed, total: known, bytes: courseBytes });
  report();

  try {
    while (wave.length) {
      const discovered = await mapPool(wave, POOL, async (job) => storeJob(job), signal);
      const next: Job[] = [];
      for (const assets of discovered) {
        for (const asset of assets) {
          if (seen.has(asset.path)) continue;
          seen.add(asset.path);
          next.push(asset);
        }
      }
      known += next.length;
      wave = next;
      report();
    }
  } catch (error) {
    await caches.delete(courseCache);
    throw error;
  }

  const record: CourseDownloadRecord = {
    slug: course.slug,
    title: course.title,
    bytes: courseBytes,
    savedAt: new Date().toISOString(),
    pages: pages.length,
  };
  await writeCourseRecord(record);
  notifyOfflineCatalog();
  return record;

  async function storeJob(job: Job): Promise<Job[]> {
    if (signal?.aborted) throw new DOMException("The download was cancelled.", "AbortError");
    const requested = new URL(job.path, origin);
    const response = await fetch(requested, { cache: "no-store", credentials: "same-origin", signal });
    if (!response.ok) {
      if (!job.page && response.status === 404) {
        completed += 1;
        report();
        return [];
      }
      throw new Error(job.page ? `Couldn't save ${job.path} (${response.status}).` : `Couldn't save a file this course needs (${job.path}).`);
    }
    const body = await response.arrayBuffer();
    const type = response.headers.get("content-type");
    const stored = () => responseForCache(body, type);
    const cache = await cacheFor(job.cache);
    await cache.put(requested.toString(), stored());
    if (response.url && response.url !== requested.toString()) await cache.put(response.url, stored());
    if (job.cache.startsWith(COURSE_CACHE_PREFIX)) courseBytes += body.byteLength;
    completed += 1;
    report();
    if (!shouldParseForAssets(type, job.path)) return [];
    return extractAssetUrls(decodeText(body), requested.toString()).map((path) => ({ path, cache: job.cache, page: false }));
  }
}

export async function removeCourseDownload(slug: string): Promise<void> {
  await caches.delete(courseCacheName(slug));
  await deleteCourseRecord(slug);
  notifyOfflineCatalog();
}

/** Caches the shell once per visit so Add to Home Screen can open with no signal. Tests skip this; they download explicitly. */
export async function warmShell(): Promise<void> {
  if (typeof navigator === "undefined" || navigator.webdriver) return;
  try {
    await ensureServiceWorker();
    const origin = location.origin;
    const cache = await caches.open(SHELL_CACHE);
    for (const path of SHELL_PATHS) {
      const url = new URL(path, origin).toString();
      if (await cache.match(url)) continue;
      const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) continue;
      const body = await response.arrayBuffer();
      await cache.put(url, responseForCache(body, response.headers.get("content-type")));
    }
  } catch {
    /* the course download retries the shell; a failed warm-up shouldn't surface */
  }
}
