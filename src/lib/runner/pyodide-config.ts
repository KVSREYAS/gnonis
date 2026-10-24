/**
 * Single source of truth for the in-browser Python runtime.
 *
 * Pyodide 314.0.7 is published, and its jsDelivr URL returns 200, but that build throws
 * "Classic web workers are not supported" while `importScripts` evaluates `pyodide.js`.
 * Browsers report that as "The script failed to load". 0.29.5 (npm dist-tag `stable-0.29`,
 * released 2026-09-16) is the current stable line that still loads from a classic worker via
 * `importScripts`, which is what iPhone Safari runs reliably. A module-worker fallback covers
 * browsers where `importScripts` fails and newer loaders that ship `pyodide.mjs`.
 */
export const PYODIDE_VERSION = "0.29.5";

/** Same-origin classic worker. Also started with `{ type: "module" }` as a fallback. */
export const PYODIDE_WORKER_URL = "/workers/pyodide-worker.js";

const jsDelivrFull = (version: string) => `https://cdn.jsdelivr.net/pyodide/v${version}/full/`;
const jsDelivrNpm = (version: string) => `https://cdn.jsdelivr.net/npm/pyodide@${version}/`;
const unpkg = (version: string) => `https://unpkg.com/pyodide@${version}/`;

function withSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

/** Index directories, primary first. An optional env URL is tried before the pinned CDNs. */
export function pyodideIndexUrls(version = PYODIDE_VERSION): string[] {
  const pinned = [jsDelivrFull(version), jsDelivrNpm(version), unpkg(version)];
  const override = process.env.NEXT_PUBLIC_PYODIDE_INDEX_URL?.trim();
  if (!override) return pinned;
  const first = withSlash(override);
  return [first, ...pinned.filter((url) => url !== first)];
}

export function pyodideScriptUrl(indexUrl: string): string {
  return `${withSlash(indexUrl)}pyodide.js`;
}

export function pyodideModuleUrl(indexUrl: string): string {
  return `${withSlash(indexUrl)}pyodide.mjs`;
}

/** Origins the runtime fetches (loader, wasm, stdlib, packages). */
export function pyodideCspOrigins(version = PYODIDE_VERSION): string[] {
  return [...new Set(pyodideIndexUrls(version).map((url) => new URL(url).origin))];
}

function supabaseConnectSources(supabaseUrl?: string | null): string[] {
  const sources = ["https://*.supabase.co", "wss://*.supabase.co"];
  const raw = supabaseUrl?.trim();
  if (!raw) return sources;
  try {
    const origin = new URL(raw).origin;
    sources.unshift(origin, origin.replace(/^http/, "ws"));
  } catch {
    /* ignore a malformed build-time URL */
  }
  return [...new Set(sources)];
}

/**
 * Content-Security-Policy for the app. Pyodide needs the CDN on script-src (importScripts and
 * module import), connect-src (wasm and packages), and 'wasm-unsafe-eval'. worker-src allows the
 * same-origin worker plus blob workers Pyodide may spawn.
 */
export function contentSecurityPolicy(options?: { dev?: boolean; supabaseUrl?: string | null }): string {
  const origins = pyodideCspOrigins();
  const script = ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", ...origins];
  const connect = ["'self'", ...origins, ...supabaseConnectSources(options?.supabaseUrl)];
  if (options?.dev) {
    script.push("'unsafe-eval'");
    connect.push("ws:", "http://localhost:*", "http://127.0.0.1:*", "ws://localhost:*", "ws://127.0.0.1:*");
  }
  return [
    "default-src 'self'",
    `script-src ${script.join(" ")}`,
    `worker-src 'self' blob: ${origins.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");
}
