import { expect, test } from "@playwright/test";

const COURSE = "/courses/sample-bits-bytes";
const LESSON = "/courses/sample-bits-bytes/01-number-formats/01-bytes-per-number";
const PROGRESS_KEY = "inference-academy:progress:v1";
const LESSON_KEY = "sample-bits-bytes/01-number-formats/01-bytes-per-number";

test("a downloaded course plays offline and keeps skips and completions", async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.goto(COURSE);
  await page.waitForFunction(() => "serviceWorker" in navigator);
  await page.getByTestId("offline-download-sample-bits-bytes").click();
  await expect(page.getByTestId("offline-ready-sample-bits-bytes")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("offline-ready-sample-bits-bytes")).toContainText(/Downloaded · \d/);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await expect(page.getByTestId("offline-indicator")).toBeVisible();
  await page.goto(LESSON);
  await expect(page.getByTestId("lesson-card")).toContainText("Bits on a budget");
  await expect(page.getByTestId("offline-indicator")).toBeVisible();

  const action = page.getByTestId("primary-action");
  await action.click();
  await expect(page.getByTestId("lesson-exercise")).toBeVisible();
  const calcToggle = page.getByTestId("exercise-calc-toggle");
  if ((await calcToggle.getAttribute("aria-expanded")) !== "true") await calcToggle.click();
  await page.getByTestId("exercise-calc-input").fill("2*16");
  await page.getByTestId("exercise-calc-run").click();
  await expect(page.getByTestId("exercise-calc-result")).toContainText("32");
  await expect(page.getByTestId("offline-indicator")).toBeVisible();
  await page.getByTestId("bf16-size-option-1").click();
  await action.click();
  await expect(page.getByTestId("feedback")).toHaveAttribute("data-correct", "true");
  await action.click();
  await action.click();
  await page.getByTestId("skip-exercise").click();
  await expect(page.getByTestId("mission-passed")).toBeVisible();

  const saved = await page.evaluate((key) => localStorage.getItem(key), PROGRESS_KEY);
  const state = JSON.parse(saved ?? "{}") as {
    lessons?: Record<string, unknown>;
    exercises?: Record<string, { correct?: boolean; skipped?: boolean }>;
  };
  expect(state.lessons?.[LESSON_KEY]).toBeTruthy();
  expect(state.exercises?.[`${LESSON_KEY}#bf16-size`]?.correct).toBe(true);
  expect(state.exercises?.[`${LESSON_KEY}#sizes-fill`]?.skipped).toBe(true);

  await context.setOffline(false);
  await page.goto(COURSE);
  await expect(page.getByTestId("hud-xp")).not.toHaveText("0 XP");
  await expect(page.getByTestId("offline-indicator")).toHaveCount(0);

  await page.getByTestId("offline-remove-sample-bits-bytes").click();
  await expect(page.getByTestId("offline-download-sample-bits-bytes")).toBeVisible();

  await context.setOffline(true);
  await page.goto(LESSON);
  await expect(page.locator("#offline-fallback")).toBeVisible();
  await expect(page.locator("#offline-fallback")).toContainText("isn't saved on this device");
});
