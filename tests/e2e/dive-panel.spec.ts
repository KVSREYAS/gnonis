import { expect, test } from "@playwright/test";

const SETTINGS_KEY = "inference-academy:settings:v1";
const DIVE_KEY = "gnosis:dive-panel";

test("dive deeper defaults open on a wide screen and closed after the learner dismisses it", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop default");
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-dive-panel", "open");
  await expect(page.locator("html")).toHaveAttribute("data-dive-layout", "drawer");

  await page.addInitScript(
    ([settingsKey, diveKey]) => {
      localStorage.setItem(settingsKey, JSON.stringify({ device: "phone" }));
      localStorage.removeItem(diveKey);
    },
    [SETTINGS_KEY, DIVE_KEY] as const,
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-dive-panel", "closed");
  await expect(page.locator("html")).toHaveAttribute("data-dive-layout", "sheet");
});

test("a saved close stays closed on the next page, including desktop", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop default");
  await page.addInitScript((key) => localStorage.setItem(key, "closed"), DIVE_KEY);
  await page.goto("/courses");
  await expect(page.locator("html")).toHaveAttribute("data-dive-panel", "closed");
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-dive-panel", "closed");
});

test("dive deeper stays closed on a phone unless the learner opened it", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone default");
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-dive-panel", "closed");
  await expect(page.locator("html")).toHaveAttribute("data-dive-layout", "sheet");

  await page.addInitScript((key) => localStorage.setItem(key, "open"), DIVE_KEY);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-dive-panel", "open");
  await expect(page.locator("html")).toHaveAttribute("data-dive-layout", "sheet");
});
