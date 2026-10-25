import { expect, test } from "@playwright/test";

test("the home page sells any subject, one mission at a time", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Gnosis");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Learn anything, one mission at a time/);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", /Learn anything, one mission at a time/);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Gnosis");
  await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute("content", /Learn anything, one mission at a time/);
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", "Gnosis");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/LEARN ANYTHING,\s*ONE MISSION\s*AT A TIME/);
  await expect(page.getByRole("heading", { level: 1 })).not.toContainText(/models|inference|tokens/i);
  await expect(page.getByText("Decode at batch size 1")).toHaveCount(0);
  const tagline = page.getByRole("banner").getByText("One mission at a time");
  const width = page.viewportSize()?.width ?? 0;
  if (width >= 1024) await expect(tagline).toBeVisible();
  else await expect(tagline).toBeHidden();
  await expect(page.getByRole("banner")).not.toContainText(/Token Rookie|Inference Legend/);
});

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
