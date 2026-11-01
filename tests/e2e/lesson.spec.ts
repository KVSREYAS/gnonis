import { expect, test } from "@playwright/test";

const LESSON = "/courses/sample-bits-bytes/01-number-formats/01-bytes-per-number";

test("plays a lesson through to MISSION PASSED", async ({ page }) => {
  await page.goto(LESSON);
  const action = page.getByTestId("primary-action");

  await expect(page.getByTestId("lesson-card")).toContainText("Bits on a budget");
  await action.click();

  await expect(page.getByTestId("lesson-exercise")).toHaveAttribute("data-exercise-type", "mcq");
  await expect(action).toBeDisabled();
  await page.getByTestId("bf16-size-option-1").click();
  await action.click();
  await expect(page.getByTestId("feedback")).toHaveAttribute("data-correct", "true");
  await action.click();

  await expect(page.getByTestId("lesson-card")).toContainText("Why it matters");
  await action.click();

  await expect(page.getByTestId("lesson-exercise")).toHaveAttribute("data-exercise-type", "fill");
  await page.getByTestId("sizes-fill-chip-0").click();
  await page.getByTestId("sizes-fill-chip-1").click();
  await action.click();
  await expect(page.getByTestId("feedback")).toHaveAttribute("data-correct", "true");
  await expect(action).toHaveText(/finish mission/i);
  await action.click();

  await expect(page.getByTestId("mission-passed")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId("mission-passed")).toContainText("bf16 keeps fp32's exponent range");
  await expect(page.getByTestId("hud-xp")).toHaveText("$00000050");
  await expect(page.getByTestId("mission-next")).toBeVisible();
});

test("wrong answers get instant feedback and a retry", async ({ page }) => {
  await page.goto(LESSON);
  const action = page.getByTestId("primary-action");
  await action.click();
  await page.getByTestId("bf16-size-option-2").click();
  await action.click();
  await expect(page.getByTestId("feedback")).toHaveAttribute("data-correct", "false");
  await expect(action).toHaveText(/try again/i);
  await action.click();
  await expect(page.getByTestId("feedback")).toHaveCount(0);
});

test("skip and already-known unlock the next lesson and can be retried", async ({ page }) => {
  await page.goto(LESSON);
  const action = page.getByTestId("primary-action");
  await action.click();
  await page.getByTestId("know-exercise").click();
  await expect(page.getByTestId("lesson-card")).toContainText("Why it matters");
  await expect(page.getByTestId("lesson-skipped-count")).toHaveText("1 skipped");
  await action.click();
  await page.getByTestId("skip-exercise").click();
  await expect(page.getByTestId("mission-passed")).toBeVisible({ timeout: 8_000 });
  await expect(page.getByTestId("mission-skipped")).toContainText("2 exercises skipped");
  await expect(page.getByTestId("hud-xp")).toHaveText("$00000030");

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("inference-academy:progress:v1") || "{}"));
  const lessonKey = "sample-bits-bytes/01-number-formats/01-bytes-per-number";
  expect(saved.exercises[`${lessonKey}#bf16-size`]).toMatchObject({ correct: false, skipped: true, skipReason: "know" });
  expect(saved.exercises[`${lessonKey}#sizes-fill`]).toMatchObject({ correct: false, skipped: true, skipReason: "skip" });
  expect(saved.lessons[lessonKey]).toBeTruthy();

  await page.goto("/courses/sample-bits-bytes");
  await expect(page.getByTestId("blip-skipped-01-bytes-per-number")).toBeVisible();
  await expect(page.getByTestId("respect-skipped")).toContainText("2 skipped");
  await expect(page.getByRole("progressbar", { name: /Respect/ })).toHaveAttribute("aria-valuenow", "13");
  await expect(page.getByTestId("next-blip")).toHaveAttribute("aria-label", /Concepts: Bits, Bytes and Number Formats, next up/);
  await page.goto("/courses/sample-bits-bytes/01-number-formats");
  const missions = page.getByRole("list", { name: "Missions in this district" });
  await expect(missions.getByRole("link").nth(0)).toHaveAttribute("href", /\/00-concepts$/);
  await expect(missions.getByRole("link").nth(1)).toHaveAttribute("href", /\/01-bytes-per-number$/);
  await expect(page.getByTestId("lesson-skipped-01-bytes-per-number")).toContainText("2 skipped");

  await page.goto(LESSON);
  await action.click();
  await expect(page.getByTestId("exercise-skipped")).toHaveAttribute("data-reason", "know");
  await page.getByTestId("unskip-exercise").click();
  await expect(page.getByTestId("exercise-skipped")).toHaveCount(0);
  await expect(page.getByTestId("skip-exercise")).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem("inference-academy:progress:v1") || "{}");
        return saved.exercises["sample-bits-bytes/01-number-formats/01-bytes-per-number#bf16-size"]?.skipped;
      }),
    )
    .toBe(false);
});

test("desktop-only exercises are flagged in phone mode", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone-only behaviour");
  await page.goto("/courses/llm-inference/01-tokens-forward-pass");
  await expect(page.getByText("Desktop mission").first()).toBeVisible();
});
