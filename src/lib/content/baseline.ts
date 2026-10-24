export type BaselineDiffDecision = { check: true } | { check: false; warning?: string };

/**
 * The progress-id diff needs a baseline commit. Vercel’s checkout is shallow and has no
 * `origin/main`, and `VERCEL` is set on every build there. Skip that diff in either case.
 * `CONTENT_SKIP_BASELINE=1` stays a quiet skip for local fixtures.
 */
export function decideBaselineDiff(input: {
  skipBaseline: string | undefined;
  vercel: string | undefined;
  ref: string;
  refAvailable: boolean;
}): BaselineDiffDecision {
  if (input.skipBaseline === "1") return { check: false };
  if (input.vercel) {
    return {
      check: false,
      warning: `skipping content baseline diff against ${input.ref} because VERCEL is set. Schema, registry, retired-id, and rename checks still run.`,
    };
  }
  if (!input.refAvailable) {
    return {
      check: false,
      warning: `content baseline ref "${input.ref}" is not available; skipping the progress-id diff. Schema, registry, retired-id, and rename checks still run.\n  Run: git fetch origin main`,
    };
  }
  return { check: true };
}
