import { expect, test } from "@playwright/test";

const SOLUTION = `import math

def softmax(logits, temperature=1.0):
    scaled = [x / temperature for x in logits]
    m = max(scaled)
    exps = [math.exp(x - m) for x in scaled]
    z = sum(exps)
    return [e / z for e in exps]
`;

test.describe("python exercises", () => {
  test.describe.configure({ timeout: 180_000 });

  test("loads Pyodide, runs softmax, and recovers from a failed load and a timeout", async ({ page, isMobile }) => {
    test.skip(isMobile, "the softmax exercise is a desktop mission");

    const blockRuntime = async () => {
      await page.route(/cdn\.jsdelivr\.net|unpkg\.com/, (route) => route.abort());
    };
    await blockRuntime();
    await page.goto("/preview/llm-inference/03-logits-to-tokens");

    const action = page.getByTestId("primary-action");
    for (let step = 0; step < 12; step += 1) {
      if (await page.getByTestId("code-editor").isVisible().catch(() => false)) break;
      const skip = page.getByRole("button", { name: "Skip", exact: true });
      if (await skip.isVisible().catch(() => false)) {
        await skip.click();
        continue;
      }
      await action.click();
    }
    await expect(page.getByTestId("code-editor")).toBeVisible();
    await expect(page.getByTestId("python-load-error")).toContainText("Python failed to load — Retry", { timeout: 20_000 });
    await expect(page.getByTestId("run-timing")).toHaveCount(0);

    await page.unroute(/cdn\.jsdelivr\.net|unpkg\.com/);
    await page.getByTestId("python-retry").click();
    await expect(action).toHaveText(/Run hidden tests/i, { timeout: 90_000 });

    await action.click();
    await expect(page.getByTestId("test-report")).toContainText(/probabilities sum to 1|assertion failed|sum was/, { timeout: 30_000 });
    await expect(page.getByTestId("python-load-error")).toHaveCount(0);

    await page.getByTestId("code-editor").fill("while True:\n    pass\n");
    await action.click();
    await expect(page.getByTestId("test-report")).toContainText(/Timed out/i, { timeout: 20_000 });

    await page.getByTestId("code-editor").fill(SOLUTION);
    await action.click();
    await expect(page.getByTestId("feedback")).toHaveAttribute("data-correct", "true", { timeout: 90_000 });
    await expect(page.getByTestId("test-report")).toContainText("lower temperature sharpens the distribution");
  });
});
