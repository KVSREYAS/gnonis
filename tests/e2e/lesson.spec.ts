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

test("desktop-only exercises are flagged in phone mode", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone-only behaviour");
  await page.goto("/courses/llm-inference/01-tokens-forward-pass");
  await expect(page.getByText("Desktop mission").first()).toBeVisible();
});
