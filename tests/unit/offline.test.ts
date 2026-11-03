import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SHELL_CACHE, coursePagePaths, extractAssetUrls, formatBytes, responseForCache } from "@/lib/offline/catalog";
import { offlinePolicy } from "@/lib/offline/policy";

describe("course pages for offline download", () => {
  it("includes the map, ready districts, and every lesson, and skips a stub district page", () => {
    expect(
      coursePagePaths({
        slug: "sample",
        modules: [
          { slug: "bay", status: "ready", lessons: [{ slug: "concepts" }, { slug: "boss" }] },
          { slug: "later", status: "stub", lessons: [] },
        ],
      }),
    ).toEqual(["/courses/sample", "/courses/sample/bay", "/courses/sample/bay/concepts", "/courses/sample/bay/boss"]);
  });
});

describe("assets pulled off a saved page", () => {
  const html = `
    <html>
      <head>
        <link rel="stylesheet" href="/_next/static/css/app.css" />
        <link rel="preload" as="script" href="/_next/static/chunks/main.js" />
        <link rel="prefetch" href="/courses/other-pack" />
        <script src="/_next/static/chunks/lesson.js"></script>
      </head>
      <body>
        <a href="/courses/other-pack">Other</a>
        <img src="/diagrams/sample/one.png" srcset="/diagrams/sample/one.png 1x, /diagrams/sample/one@2.png 2x" />
        <img src="https://cdn.example/nope.png" />
      </body>
    </html>
  `;

  it("keeps scripts, styles, and pictures, and ignores links to other courses", () => {
    const urls = extractAssetUrls(html, "https://gnonis.vercel.app/courses/sample/bay/one");
    expect(urls).toEqual([
      "/_next/static/chunks/lesson.js",
      "/diagrams/sample/one.png",
      "/diagrams/sample/one@2.png",
      "/_next/static/css/app.css",
      "/_next/static/chunks/main.js",
    ]);
  });

  it("follows font urls inside a stylesheet", () => {
    const css = `@font-face{font-family:Body;src:url(/_next/static/media/body.woff2) format("woff2")}`;
    expect(extractAssetUrls(css, "https://gnonis.vercel.app/_next/static/css/app.css")).toEqual(["/_next/static/media/body.woff2"]);
  });
});

describe("cached responses", () => {
  it("drops the encoding and vary headers so a later navigation can match", async () => {
    const encoded = new TextEncoder().encode("hi");
    const stored = responseForCache(encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength), "text/html; charset=utf-8");
    expect(stored.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(stored.headers.get("vary")).toBeNull();
    expect(stored.headers.get("content-encoding")).toBeNull();
    expect(await stored.text()).toBe("hi");
  });
});

describe("offline policy", () => {
  it("turns off network features and leaves the calculator on", () => {
    expect(offlinePolicy(false)).toEqual({
      chat: false,
      webSearch: false,
      highlightAsk: false,
      openInChatgpt: false,
      cloudCpp: false,
      signIn: false,
      calculator: true,
      clientChecks: true,
    });
    expect(offlinePolicy(true).chat).toBe(true);
    expect(offlinePolicy(true).signIn).toBe(true);
  });
});

describe("download size", () => {
  it("formats bytes the way the button shows them", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(900)).toBe("900 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(12 * 1024)).toBe("12 KB");
    expect(formatBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });
});

describe("service worker", () => {
  it("uses the same shell cache name as the downloader", () => {
    const source = readFileSync("public/sw.js", "utf8");
    expect(source).toContain(SHELL_CACHE);
    expect(source).toContain('request.headers.get("rsc")');
  });
});
