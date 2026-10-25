import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");
const mirror = readFileSync(new URL("../../src/components/widgets/code-mirror.ts", import.meta.url), "utf8");

type Rgb = { r: number; g: number; b: number; a: number };

function block(source: string, selector: string): string {
  const start = source.indexOf(selector);
  if (start < 0) throw new Error(`missing ${selector}`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`unclosed ${selector}`);
}

function variable(body: string, name: string): string {
  const match = body.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`missing ${name}`);
  return match[1].trim();
}

function parseColor(value: string): Rgb {
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((channel) => channel + channel).join("");
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  const rgb = value.match(/^rgb\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/);
  if (!rgb) throw new Error(`unparsed color ${value}`);
  return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: rgb[4] === undefined ? 1 : Number(rgb[4]) };
}

function blend(color: Rgb, onto: Rgb): Rgb {
  const a = color.a;
  return {
    r: color.r * a + onto.r * (1 - a),
    g: color.g * a + onto.g * (1 - a),
    b: color.b * a + onto.b * (1 - a),
    a: 1,
  };
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(color: Rgb): number {
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

function contrast(a: Rgb, b: Rgb): number {
  const left = luminance(a);
  const right = luminance(b);
  const [hi, lo] = left >= right ? [left, right] : [right, left];
  return (hi + 0.05) / (lo + 0.05);
}

const root = block(css, ":root {");
const light = block(css, '[data-theme="light"] {');

describe("editor caret", () => {
  it("draws a 2px theme caret on the CodeMirror cursor and on other code inputs", () => {
    expect(css).toMatch(/\.cm-cursor\s*,\s*\n\.cm-editor \.cm-dropCursor/);
    expect(css).toMatch(/border-left-width:\s*2px\s*!important/);
    expect(css).toMatch(/border-left-color:\s*var\(--caret\)\s*!important/);
    expect(css).toMatch(/\.cm-editor \.cm-content[\s\S]*caret-color:\s*var\(--caret\)/);
    expect(css).toMatch(/\.code-input[\s\S]*caret-color:\s*var\(--caret\)/);
    expect(mirror).toContain('caretColor: "var(--caret)"');
    expect(mirror).toContain('".cm-cursor, .cm-dropCursor"');
    expect(mirror).toContain('borderLeftWidth: "2px"');
    expect(mirror).not.toMatch(/caretColor:\s*"var\(--gold\)"/);
  });

  it("keeps the caret, text, and active line readable in both themes", () => {
    for (const [name, body] of [
      ["dark", root],
      ["light", light],
    ] as const) {
      const ink = parseColor(variable(body, "--ink"));
      const text = parseColor(variable(body, "--text"));
      const caret = parseColor(variable(body, "--caret"));
      const gold = parseColor(variable(body, "--gold-ink"));
      const active = blend(parseColor(variable(body, "--editor-active-line")), ink);
      const selection = blend(parseColor(variable(body, "--editor-selection")), ink);

      expect(caret, name).toEqual(name === "dark" ? parseColor("#fff") : parseColor("#141414"));
      for (const surface of [ink, active, selection]) {
        expect(contrast(caret, surface), `${name} caret`).toBeGreaterThanOrEqual(7);
        expect(contrast(text, surface), `${name} text`).toBeGreaterThanOrEqual(7);
        expect(contrast(gold, surface), `${name} gold`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(selection, ink), `${name} selection against the page`).toBeGreaterThan(1.15);
    }
  });
});
