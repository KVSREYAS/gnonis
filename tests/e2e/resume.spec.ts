import { expect, test, type Page } from "@playwright/test";

const LESSON = "/courses/sample-bits-bytes/01-number-formats/01-bytes-per-number";
const PROGRESS_KEY = "inference-academy:progress:v1";
const LESSON_KEY = "sample-bits-bytes/01-number-formats/01-bytes-per-number";

async function placeStep(page: Page) {
  return page.evaluate(
    ([key, lessonKey]) => {
      const saved = JSON.parse(localStorage.getItem(key) || "{}") as { places?: Record<string, { step?: number | null }> };
      return saved.places?.[lessonKey]?.step ?? null;
    },
    [PROGRESS_KEY, LESSON_KEY] as const,
  );
}

test("reopens a lesson on the step you left, including the first slide", async ({ page }) => {
  await page.goto(LESSON);
  const action = page.getByTestId("primary-action");
  await expect(page.getByTestId("lesson-card")).toContainText("Bits on a budget");
  await expect(page.locator("[data-lesson-player]")).toHaveAttribute("data-step-index", "0");

  await action.click();
  await expect(page.getByTestId("lesson-exercise")).toBeVisible();
  await expect.poll(() => placeStep(page)).toBe(1);

  await page.goto("/courses/sample-bits-bytes");
  await page.goto(LESSON);
  await expect(page.getByTestId("lesson-exercise")).toBeVisible();
  await expect(page.getByTestId("lesson-card")).toHaveCount(0);
  await expect(page.getByTestId("lesson-resumed")).toBeVisible();
  await expect(page.locator("[data-lesson-player]")).toHaveAttribute("data-step-index", "1");

  await page.getByRole("button", { name: "Previous step" }).click();
  await expect(page.getByTestId("lesson-card")).toContainText("Bits on a budget");
  await expect.poll(() => placeStep(page)).toBe(0);

  await page.reload();
  await expect(page.getByTestId("lesson-card")).toContainText("Bits on a budget");
  await expect(page.getByTestId("lesson-exercise")).toHaveCount(0);
  await expect(page.locator("[data-lesson-player]")).toHaveAttribute("data-step-index", "0");
});

test("finishing a lesson clears the resume point", async ({ page }) => {
  await page.goto(LESSON);
  const action = page.getByTestId("primary-action");
  await expect(page.getByTestId("lesson-card")).toBeVisible();
  await action.click();
  await page.getByTestId("know-exercise").click();
  await expect(page.getByTestId("lesson-card")).toContainText("Why it matters");
  await action.click();
  await page.getByTestId("skip-exercise").click();
  await expect(page.getByTestId("mission-passed")).toBeVisible();
  await expect.poll(() => placeStep(page)).toBeNull();

  await page.goto(LESSON);
  await expect(page.getByTestId("lesson-card")).toContainText("Bits on a budget");
  await expect(page.getByTestId("lesson-resumed")).toHaveCount(0);
  await expect(page.locator("[data-lesson-player]")).toHaveAttribute("data-step-index", "0");
});

test("resetting progress forgets the resume point", async ({ page }) => {
  await page.goto(LESSON);
  await page.getByTestId("primary-action").click();
  await expect(page.getByTestId("lesson-exercise")).toBeVisible();
  await expect.poll(() => placeStep(page)).toBe(1);

  await page.getByTestId("menu-button").click();
  await page.getByRole("button", { name: "Reset progress" }).click();
  await page.getByRole("button", { name: "Yes, wipe progress" }).click();
  await expect.poll(() => placeStep(page)).toBeNull();

  await page.goto(LESSON);
  await expect(page.getByTestId("lesson-card")).toContainText("Bits on a budget");
  await expect(page.getByTestId("lesson-exercise")).toHaveCount(0);
});
