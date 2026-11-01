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

  test("runs samples and submit on the local runner when Run on my PC is on", async ({ page }) => {
    const seen: { url: string; token: string | undefined; body: Record<string, unknown> }[] = [];
    const sandbox: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/code/cpp")) sandbox.push(request.url());
    });
    await page.route("http://127.0.0.1:8787/**", async (route) => {
      const request = route.request();
      const origin = request.headers()["origin"] ?? "http://127.0.0.1:4319";
      const cors = {
        "access-control-allow-origin": origin,
        "access-control-allow-headers": "content-type, x-gnosis-runner-token",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-private-network": "true",
      };
      if (request.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: cors });
        return;
      }
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          headers: cors,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, compiler: "g++", triple: "x86_64-w64-mingw32", archOk: true }),
        });
        return;
      }
      seen.push({ url: request.url(), token: request.headers()["x-gnosis-runner-token"], body: request.postDataJSON() });
      await route.fulfill({
        status: 200,
        headers: cors,
        contentType: "application/json",
        body: JSON.stringify({
          error: null,
          stdout: "local-ok",
          stderr: "",
          tests: [{ name: "checks", passed: true }],
          passed: 1,
          total: 1,
          failure: null,
        }),
      });
    });

    await page.goto("/preview/sample-bits-bytes/03-field-kit");
    const action = page.getByTestId("primary-action");
    for (let step = 0; step < 30; step += 1) {
      if (await page.getByTestId("local-runner-toggle").isVisible().catch(() => false)) break;
      const skip = page.getByTestId("action-bar").getByRole("button", { name: "Skip", exact: true });
      if (await skip.isVisible().catch(() => false)) {
        await skip.click({ force: true });
        continue;
      }
      await action.click();
    }
    await expect(page.getByTestId("local-runner-settings")).toBeVisible();
    await expect(page.getByTestId("run-samples")).toBeDisabled();

    await page.getByTestId("local-runner-toggle").click();
    await page.getByTestId("local-runner-port").fill("8787");
    await page.getByTestId("local-runner-token").fill("pair-token");
    await expect(page.getByTestId("local-runner-status")).toContainText("Connected");
    await expect(page.getByText("C++ · COMPILES ON THIS PC")).toBeVisible();
    await expect(page.getByTestId("run-samples")).toBeEnabled();

    await page.getByTestId("run-samples").click();
    await expect(page.getByTestId("run-report")).toContainText("local-ok");
    expect(seen.at(-1)?.url).toContain("/run");
    expect(seen.at(-1)?.token).toBe("pair-token");
    expect(seen.at(-1)?.body).toMatchObject({
      action: "run",
      runKind: "samples",
      lessonId: "sample-bits-bytes/01-number-formats/03-field-kit",
      exerciseId: "add-two",
    });
    expect(String(seen.at(-1)?.body.tests)).toContain("CHECK(add(2, 3) == 5)");
    expect(sandbox).toEqual([]);

    await page.getByTestId("custom-stdin").fill("42");
    await page.getByTestId("run-code").click();
    await expect.poll(() => seen.at(-1)?.body.runKind).toBe("stdin");
    expect(seen.at(-1)?.body.stdin).toBe("42");

    await action.click();
    await expect(page.getByTestId("test-report")).toContainText("1/1 passed");
    expect(seen.at(-1)?.body.action).toBe("submit");
    expect(seen.at(-1)?.body.tests).toBeUndefined();

    const stored = await page.evaluate(() => localStorage.getItem("gnosis:cpp-local-runner:v1"));
    expect(JSON.parse(stored || "{}")).toMatchObject({ enabled: true, port: 8787, token: "pair-token" });
  });
});
