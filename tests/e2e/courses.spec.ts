import { expect, test } from "@playwright/test";

test("the courses index lists every pack and opens its map", async ({ page }) => {
  await page.goto("/courses");
  await expect(page.getByRole("heading", { name: "MISSION PACKS" })).toBeVisible();
  const inference = page.getByTestId("course-llm-inference");
  const sample = page.getByTestId("course-sample-bits-bytes");
  await expect(inference).toHaveAttribute("href", "/courses/llm-inference");
  await expect(sample).toHaveAttribute("href", "/courses/sample-bits-bytes");
  await sample.click();
  await expect(page).toHaveURL(/\/courses\/sample-bits-bytes$/);
  await expect(page.getByTestId("district-01-number-formats")).toBeVisible();
  const lesson = page.getByTestId("next-blip");
  await expect(lesson).toHaveAttribute("href", "/courses/sample-bits-bytes/01-number-formats/01-bytes-per-number");
  await lesson.click();
  await expect(page).toHaveURL(/\/courses\/sample-bits-bytes\/01-number-formats\/01-bytes-per-number$/);
});
