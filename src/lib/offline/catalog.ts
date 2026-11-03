import { courseHref, lessonHref, moduleHref } from "@/lib/content/navigation";

/** Cache for the app shell: home, course index, icons, and the offline fallback. */
export const SHELL_CACHE = "gnosis-shell-v1";

/** Per-course pages and the assets discovered from them. `caches.delete` drops one course. */
export const COURSE_CACHE_PREFIX = "gnosis-course-v1:";

export function courseCacheName(slug: string) {
  return `${COURSE_CACHE_PREFIX}${slug}`;
}

/**
 * Routes and files the installed app needs before any course is opened.
 * `/manifest.webmanifest` is the App Router manifest route.
 */
export const SHELL_PATHS = [
  "/",
  "/courses",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
] as const;

export type CoursePages = {
  slug: string;
  modules: { slug: string; status: "ready" | "stub"; lessons: { slug: string }[] }[];
};

/** Map, ready district intros, and every lesson (concepts, exercises, and bosses share this URL). */
export function coursePagePaths(course: CoursePages): string[] {
  const paths = [courseHref(course.slug)];
  for (const mod of course.modules) {
    if (mod.status === "ready") paths.push(moduleHref(course.slug, mod.slug));
    for (const lesson of mod.lessons) paths.push(lessonHref(course.slug, mod.slug, lesson.slug));
  }
  return paths;
}

const SKIP_SCHEME = /^(?:data|blob|javascript|mailto|tel):/i;
const LINK_RELS = new Set(["stylesheet", "icon", "apple-touch-icon", "manifest", "preload", "modulepreload"]);

/**
 * Subresources a saved page needs in order to render: scripts, styles, images, fonts.
 * Anchor tags are left out on purpose. The home page links to every course, and following
 * those would download packs the learner did not ask for.
 */
export function extractAssetUrls(source: string, pageUrl: string): string[] {
  const found = new Set<string>();
  let origin: string;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return [];
  }

  const add = (raw: string | undefined) => {
    if (!raw) return;
    const value = raw.trim();
    if (!value || value.startsWith("#") || SKIP_SCHEME.test(value)) return;
    let url: URL;
    try {
      url = new URL(value, pageUrl);
    } catch {
      return;
    }
    if (url.origin !== origin) return;
    if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;
    found.add(`${url.pathname}${url.search}`);
  };

  for (const match of source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) add(match[1]);
  for (const match of source.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) add(match[1]);
  for (const match of source.matchAll(/\bsrcset=["']([^"']+)["']/gi)) {
    for (const part of match[1].split(",")) add(part.trim().split(/\s+/)[0]);
  }
  for (const match of source.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = (/rel=["']([^"']+)["']/i.exec(tag)?.[1] ?? "").toLowerCase();
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
    if (rel.split(/\s+/).some((token) => LINK_RELS.has(token))) add(href);
  }
  // Stylesheets reference fonts with url(). HTML pages also contain anchors, so only scan CSS.
  if (!/<html[\s>]/i.test(source)) {
    for (const match of source.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) add(match[1]);
  }
  return [...found];
}

export function shouldParseForAssets(contentType: string | null, path: string): boolean {
  const type = (contentType ?? "").toLowerCase();
  if (type.includes("text/html") || type.includes("text/css")) return true;
  return /\.(?:html|css)$/i.test(path);
}

/** A Response safe to `cache.put`: decoded body, no Vary, no Content-Encoding. */
export function responseForCache(body: ArrayBuffer, contentType: string | null): Response {
  const headers = new Headers();
  if (contentType) headers.set("content-type", contentType);
  return new Response(body, { status: 200, headers });
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb >= 10 ? Math.round(kb) : kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
}
