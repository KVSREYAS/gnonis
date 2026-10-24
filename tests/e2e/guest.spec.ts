import { expect, test } from "@playwright/test";

// The e2e server is built with the Supabase env vars blanked (see playwright.config.ts), so these
// check that the app still works exactly as before in local-only guest mode.

const LESSON = "/courses/sample-bits-bytes/01-number-formats/01-bytes-per-number";
const PROGRESS_KEY = "inference-academy:progress:v1";

test("guest progress is saved in localStorage and survives a reload", async ({ page }) => {
  await page.goto(LESSON);
  await expect(page.getByTestId("signin-link")).toHaveCount(0);
  await expect(page.getByTestId("account-button")).toHaveCount(0);

  const action = page.getByTestId("primary-action");
  await action.click();
  await page.getByTestId("bf16-size-option-1").click();
  await action.click();
  await action.click();
  await action.click();
  await page.getByTestId("sizes-fill-chip-0").click();
  await page.getByTestId("sizes-fill-chip-1").click();
  await action.click();
  await action.click();
  await expect(page.getByTestId("mission-passed")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId("hud-xp")).toHaveText("$00000050");

  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), PROGRESS_KEY);
  expect(saved?.xp).toBe(50);

  await page.goto("/");
  await page.reload();
  await expect(page.getByTestId("hud-xp")).toHaveText("$00000050");

  await page.getByTestId("menu-button").click();
  await expect(page.getByText("Progress is stored on this device only.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);
});

test("the login page explains local-only mode instead of breaking", async ({ page }) => {
  await page.goto("/login?next=/courses/sample-bits-bytes");
  await expect(page.getByTestId("login-screen")).toContainText("Accounts aren't switched on");
  await expect(page.getByTestId("google-signin")).toHaveCount(0);
  await page.getByRole("link", { name: "Keep playing" }).click();
  await expect(page).toHaveURL(/\/courses\/sample-bits-bytes$/);
});

test("the auth callback is a harmless redirect without Supabase", async ({ page }) => {
  await page.goto("/auth/callback?code=whatever&next=/courses/sample-bits-bytes");
  await expect(page).toHaveURL(/\/courses\/sample-bits-bytes$/);
});
