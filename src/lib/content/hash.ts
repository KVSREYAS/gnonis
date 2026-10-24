import { createHash } from "node:crypto";

const PROSE = new Set(["prompt", "explanation", "hint", "hints", "briefing", "title", "devices", "caption", "label", "description", "help", "note", "question"]);

/** Drop wording so a typo fix does not look like a new answer. Answer-bearing fields stay. */
function omitProse(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitProse);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (PROSE.has(key)) continue;
    out[key] = omitProse(child);
  }
  return out;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Short hash of the fields that decide whether an answer is still right. */
export function exerciseContentHash(exercise: unknown): string {
  return createHash("sha256").update(stable(omitProse(exercise))).digest("hex").slice(0, 16);
}
