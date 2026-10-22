/**
 * Captures the map, a lesson card, a simulator and MISSION PASSED on desktop and phone.
 *   BASE_URL=http://127.0.0.1:4317 OUT=artifacts/screenshots node scripts/screenshots.mjs
 */
import { chromium, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4317";
const OUT = process.env.OUT ?? "artifacts/screenshots";
fs.mkdirSync(OUT, { recursive: true });

const SEED = {
  version: 1,
  xp: 1340,
  lessons: Object.fromEntries(
    ["01-what-is-a-token", "02-the-forward-pass", "03-logits-to-tokens", "04-prefill-and-decode", "05-boss-the-forward-pass"].map((l) => [
      `llm-inference/01-tokens-forward-pass/${l}`,
      { completedAt: "2026-10-20T10:00:00.000Z", xpEarned: 100, pendingDesktop: [] },
    ]).concat([["llm-inference/02-attention/01-queries-keys-values", { completedAt: "2026-10-21T10:00:00.000Z", xpEarned: 90, pendingDesktop: [] }]]),
  ),
  exercises: {},
  streak: { current: 4, best: 4, lastDay: null },
  updatedAt: null,
};

const profiles = [
  { name: "desktop", ctx: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  { name: "phone", ctx: { ...devices["Pixel 7"] } },
];

const browser = await chromium.launch();
for (const p of profiles) {
  const context = await browser.newContext(p.ctx);
  const today = new Date();
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const seed = { ...SEED, streak: { ...SEED.streak, lastDay: day } };
  await context.addInitScript((s) => {
    if (!localStorage.getItem("inference-academy:progress:v1")) localStorage.setItem("inference-academy:progress:v1", s);
  }, JSON.stringify(seed));
  const page = await context.newPage();
  const shot = async (name, opts = {}) => {
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `${p.name}-${name}.png`), ...opts });
    console.log("saved", `${p.name}-${name}.png`);
  };

  await page.goto(`${BASE}/`);
  await shot("home");

  await page.goto(`${BASE}/courses/llm-inference`);
  await page.getByTestId("next-blip").waitFor();
  await shot("map", { fullPage: p.name === "desktop" });

  await page.goto(`${BASE}/courses/llm-inference/03-kv-cache`);
  await shot("module-intro");

  await page.goto(`${BASE}/courses/llm-inference/03-kv-cache/02-sizing-the-cache`);
  await page.getByTestId("lesson-card").waitFor();
  await shot("lesson");

  // Advance to the KV-cache simulator (4th card/exercise sequence)
  await page.goto(`${BASE}/courses/llm-inference/03-kv-cache/03-the-memory-budget`);
  for (let i = 0; i < 12; i++) {
    const sim = await page.locator('[data-exercise-type="simulator"]').count();
    if (sim) break;
    const ex = await page.getByTestId("lesson-exercise").count();
    if (ex) {
      const input = page.locator('input[inputmode="decimal"]');
      if (await input.count()) {
        await input.fill("52");
        await page.getByTestId("primary-action").click();
      }
    }
    await page.getByTestId("primary-action").click();
  }
  await page.getByTestId("slider-kvBytes").waitFor();
  // Switch the KV cache to fp8 so the goal turns green, then capture the live gauges.
  await page.getByTestId("slider-kvBytes").locator('[role="slider"], input[type="range"]').first().focus();
  await page.keyboard.press("ArrowRight");
  await shot("simulator");
  if (p.name === "phone") {
    await page.locator("figure").first().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -80));
    await shot("simulator-gauges");
  }

  // Mission Passed: play the sample course's first lesson to the end
  await page.goto(`${BASE}/courses/sample-bits-bytes/01-number-formats/01-bytes-per-number`);
  await page.getByTestId("primary-action").click();
  await page.getByTestId("bf16-size-option-1").click();
  await page.getByTestId("primary-action").click();
  await page.getByTestId("primary-action").click();
  await page.getByTestId("primary-action").click();
  await page.getByTestId("sizes-fill-chip-0").click();
  await page.getByTestId("sizes-fill-chip-1").click();
  await page.getByTestId("primary-action").click();
  await page.getByTestId("primary-action").click();
  await page.getByTestId("mission-splash").waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${p.name}-mission-passed-splash.png`) });
  console.log("saved", `${p.name}-mission-passed-splash.png`);
  await page.getByTestId("mission-passed").waitFor({ timeout: 5000 });
  await page.waitForTimeout(1200);
  await shot("mission-passed");

  await context.close();
}
await browser.close();
