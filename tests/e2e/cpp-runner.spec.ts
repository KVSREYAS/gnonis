import { expect, test } from "@playwright/test";

test.describe("C++ exercises without a sandbox", () => {
  test.describe.configure({ timeout: 90_000 });

  test("shows the editor and a clear unavailable message, and does not record a grade", async ({ page }) => {
    await page.goto("/preview/sample-bits-bytes/03-field-kit");
    const action = page.getByTestId("primary-action");
    for (let step = 0; step < 30; step += 1) {
      if (await page.getByText("C++ · COMPILES ON THE SERVER").isVisible().catch(() => false)) break;
      const skip = page.getByTestId("action-bar").getByRole("button", { name: "Skip", exact: true });
      if (await skip.isVisible().catch(() => false)) {
        await skip.click({ force: true });
        continue;
      }
      await action.click();
    }
    await expect(page.getByTestId("code-editor")).toBeVisible();
    await expect(page.getByTestId("cpp-unavailable")).toContainText(/no sign-in configured/i);
    await expect(page.getByTestId("run-code")).toBeDisabled();
    await expect(page.getByTestId("run-samples")).toBeDisabled();
    await expect(action).toBeDisabled();
    await expect(page.getByTestId("feedback")).toHaveCount(0);
    await expect(page.getByTestId("run-report")).toHaveCount(0);
  });
});
