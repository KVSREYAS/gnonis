import { expect, test, type Page } from "@playwright/test";

async function openPythonEditor(page: Page) {
  await page.goto("/preview/llm-inference/03-logits-to-tokens");
  const action = page.getByTestId("primary-action");
  for (let step = 0; step < 16; step += 1) {
    if (await page.getByText("PYTHON · RUNS IN YOUR BROWSER").isVisible().catch(() => false)) break;
    const skip = page.getByTestId("action-bar").getByRole("button", { name: "Skip", exact: true });
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
      continue;
    }
    await action.click();
  }
  await expect(page.getByText("PYTHON · RUNS IN YOUR BROWSER")).toBeVisible();
  await expect(page.getByTestId("code-editor")).toBeVisible();
  await page.getByTestId("code-editor").click();
}

test.describe("editor caret", () => {
  test("is a wide white bar in dark mode and a dark bar in light mode", async ({ page, isMobile }) => {
    test.skip(isMobile, "the code editor is a desktop mission");
    test.setTimeout(60_000);

    await page.addInitScript(() => {
      localStorage.setItem(
        "inference-academy:settings:v1",
        JSON.stringify({ theme: "dark", reader: false, motion: "reduced", device: "desktop" }),
      );
    });
    await openPythonEditor(page);

    const cursor = page.locator(".cm-cursor").first();
    await expect(cursor).toBeVisible();
    await expect(cursor).toHaveCSS("border-left-color", "rgb(255, 255, 255)");
    await expect(cursor).toHaveCSS("border-left-width", "2px");
    await expect(page.locator(".cm-content")).toHaveCSS("caret-color", "rgb(255, 255, 255)");
    await expect(page.getByTestId("custom-stdin")).toHaveCSS("caret-color", "rgb(255, 255, 255)");

    await page.getByTestId("code-editor").press("ControlOrMeta+a");
    const selection = page.locator(".cm-selectionBackground").first();
    await expect(selection).toBeVisible();
    const contrast = await page.evaluate(() => {
      const parse = (value: string) => {
        const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!match) throw new Error(value);
        return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: match[4] === undefined ? 1 : Number(match[4]) };
      };
      const blend = (color: { r: number; g: number; b: number; a: number }, onto: { r: number; g: number; b: number }) => ({
        r: color.r * color.a + onto.r * (1 - color.a),
        g: color.g * color.a + onto.g * (1 - color.a),
        b: color.b * color.a + onto.b * (1 - color.a),
      });
      const channel = (value: number) => {
        const s = value / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const luminance = (color: { r: number; g: number; b: number }) => 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
      const ratio = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) => {
        const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };
      const editor = document.querySelector(".cm-editor");
      if (!editor?.parentElement) throw new Error("missing editor");
      const ink = parse(getComputedStyle(editor.parentElement).backgroundColor);
      const text = parse(getComputedStyle(editor).color);
      const active = document.querySelector(".cm-activeLine");
      const selected = document.querySelector(".cm-selectionBackground");
      const caret = document.querySelector(".cm-cursor");
      if (!active || !selected || !caret) throw new Error("missing chrome");
      const activeBg = blend(parse(getComputedStyle(active).backgroundColor), ink);
      const selectionBg = blend(parse(getComputedStyle(selected).backgroundColor), ink);
      const caretColor = parse(getComputedStyle(caret).borderLeftColor);
      return {
        caretOnActive: ratio(caretColor, activeBg),
        caretOnSelection: ratio(caretColor, selectionBg),
        textOnActive: ratio(text, activeBg),
        textOnSelection: ratio(text, selectionBg),
      };
    });
    expect(contrast.caretOnActive).toBeGreaterThanOrEqual(7);
    expect(contrast.caretOnSelection).toBeGreaterThanOrEqual(7);
    expect(contrast.textOnActive).toBeGreaterThanOrEqual(7);
    expect(contrast.textOnSelection).toBeGreaterThanOrEqual(7);

    await page.getByTestId("menu-button").click();
    await page.getByRole("switch", { name: "Light mode" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(cursor).toHaveCSS("border-left-color", "rgb(20, 20, 20)");
    await expect(cursor).toHaveCSS("border-left-width", "2px");
    await expect(page.locator(".cm-content")).toHaveCSS("caret-color", "rgb(20, 20, 20)");
    await expect(page.getByTestId("custom-stdin")).toHaveCSS("caret-color", "rgb(20, 20, 20)");
  });
});
