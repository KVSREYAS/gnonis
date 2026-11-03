/* Gnosis offline worker.
 * Online: the network wins, so a new deploy is what learners see.
 * Offline: saved shell and course caches answer navigations and their files.
 * RSC fetches (the App Router's client transitions) are left alone. While offline the
 * page turns those clicks into full loads, which this worker can answer from the HTML cache.
 * Cache names must match src/lib/offline/catalog.ts.
 */
const SHELL_CACHE = "gnosis-shell-v1";
const CACHE_PREFIX = "gnosis-";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function isRouterRequest(request) {
  const url = new URL(request.url);
  // Header names are case-insensitive. These are the App Router's client fetches,
  // not document loads, so a cached HTML page would be the wrong body.
  return (
    request.headers.get("rsc") === "1" ||
    request.headers.has("next-router-state-tree") ||
    request.headers.has("next-router-prefetch") ||
    request.headers.has("next-router-segment-prefetch") ||
    request.headers.has("next-url") ||
    url.searchParams.has("_rsc")
  );
}

async function matchCached(request) {
  const names = await caches.keys();
  for (const name of names) {
    if (!name.startsWith(CACHE_PREFIX)) continue;
    const cache = await caches.open(name);
    const hit = await cache.match(request, { ignoreSearch: true, ignoreVary: true });
    if (hit) return hit;
  }
  return null;
}

async function offlineFallback() {
  const shell = await caches.open(SHELL_CACHE);
  const page = await shell.match("/offline.html");
  if (page) return page;
  return new Response("Offline", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (isRouterRequest(request)) return;

  event.respondWith(
    (async () => {
      const offline = self.navigator.onLine === false;
      if (!offline) {
        try {
          return await fetch(request);
        } catch {
          /* fall through to the saved copy */
        }
      }
      const cached = await matchCached(request);
      if (cached) return cached;
      if (!offline) {
        try {
          return await fetch(request);
        } catch {
          /* still nothing on the network */
        }
      }
      if (request.mode === "navigate") return offlineFallback();
      return new Response("Offline", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
    })(),
  );
});
