# Gnosis

A personal, boot.dev-style course player for learning how LLM inference really works: tokens, attention, the KV cache,
GPU memory and the roofline, and more. Lessons are short reading cards with interactive missions in between: multiple
choice, fill-in chips, ordering, number prediction, tuning simulators, step-through visualisers, Python code puzzles,
debug-this, and timed boss fights.

The look is an original late-90s/early-2000s open-world crime game menu (charcoal panels, gold display type, a sunset
gradient, a district map with blips). All art is hand-made SVG. The reading surfaces stay plain and high-contrast:
Atkinson Hyperlegible at 18px, 1.6 line height, 68ch measure, with reader mode, light mode and reduced motion.

- **XP** is shown as money (`$00001340`), the **streak** as 1-6 wanted stars, and each course has a **respect bar** and rank.
- **Phone mode** is detected automatically (small screen or coarse pointer) and can be forced from the pause menu (the
  menu button in the HUD). Phones only get exercises that declare `phone`. Desktop-only ones show a **Desktop mission**
  badge and can be skipped, and the map remembers them.
- **Progress is local-first** (localStorage), behind a `ProgressStore` interface so a sync backend can be added later.
- **Python runs in the browser** via Pyodide in a Web Worker, loaded only when you reach a code exercise.

## Run it locally

Needs Node 20.9+ (CI uses 22). Python 3 is optional: if it is installed, `validate-content` also runs every code
exercise's reference solution against its hidden tests.

```bash
npm install
npm run dev            # http://127.0.0.1:4317
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 4317 |
| `npm run build` / `npm start` | Production build, then serve it on port 4317 (`next start -p 4317`) |
| `npm run validate-content` | Parses and cross-checks every course pack. Exits non-zero on any issue |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests (schema, progress, grading) |
| `npm run test:e2e` | Playwright smoke test on desktop and a Pixel 7 viewport. Builds and serves on port 4319, or set `BASE_URL` to reuse a running server |
| `node scripts/screenshots.mjs` | Captures marketing screenshots of a running server (`BASE_URL`, `OUT` env vars) |

The first Playwright run needs a browser: `npx playwright install chromium`.

CI (`.github/workflows/ci.yml`) runs content validation, lint, typecheck, unit tests and the e2e smoke test.

## Project layout

```
content/courses/<course>/          course packs (YAML + MDX, no code)
src/app/                           routes: /, /courses/[course], /[module], /[module]/[lesson]
src/components/                    HUD, map, module intro, lesson player, MISSION PASSED
src/components/widgets/            one widget per exercise type + registry.tsx
src/lib/content/                   Zod schema, loader, summaries, navigation
src/lib/sims/                      simulator models (pure functions)
src/lib/grading.ts                 graders for every exercise type + boss state machine
src/lib/progress/                  XP / streak / level logic + ProgressStore
src/lib/runner/                    CodeRunner interface, Pyodide runner, Piston stub, shared Python harness
public/workers/pyodide-worker.js   the Web Worker that hosts Pyodide
scripts/validate-content.ts        the content linter used in CI
```

## Adding a course

A course is a folder. Drop it in, run `npm run validate-content`, and it shows up on the home screen. No code changes.

```
content/courses/my-course/
  course.yaml
  modules/
    01-first-district/
      module.yaml
      lessons/
        01-hello.mdx
        02-boss-hello.mdx
```

Folder and file names are kebab-case slugs, and they become the URL (`/courses/my-course/01-first-district/01-hello`).
Order comes from the lists in `course.yaml` and `module.yaml`, not from file names. Every lesson file must be listed,
and every listed lesson must exist.

The smallest complete example is `content/courses/sample-bits-bytes/`.

### `course.yaml`

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | required |
| `tagline` | string | one line on the course card |
| `description` | string | a paragraph on the course page |
| `order` | int | home screen sort order, default `100` |
| `level` | `intro` \| `intermediate` \| `advanced` | default `intermediate` |
| `modules` | slug[] | module folder names in order, at least one |

### `module.yaml`

Each module is a "district" on the map.

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | required |
| `district` | string | district name on the map, e.g. `Token Flats` |
| `summary` | string | shown on the loading-screen intro |
| `tip` | string | the loading-screen tip line |
| `art` | `skyline` \| `docks` \| `hills` \| `grid` \| `bridge` \| `desert` \| `pier` \| `tower` | intro and tile art, default `skyline` |
| `status` | `ready` \| `stub` | stubs show as "Coming soon" and may have no lessons. Default `ready` |
| `lessons` | slug[] | lesson file names (without `.mdx`) in order. `ready` modules need at least one |

### Lesson files (`*.mdx`)

Frontmatter holds metadata and every exercise. The body holds the reading cards and says where each exercise goes.

```mdx
---
title: Bytes per number
summary: fp32, fp16, bf16, fp8, int4. Know the sizes cold.
xp: 30
keyIdeas:
  - fp32 is 4 bytes, fp16 and bf16 are 2, fp8 and int8 are 1, and int4 is half a byte.
  - bf16 keeps fp32's exponent range with fewer mantissa bits.
  - Halving the bytes per number halves memory and bandwidth.
exercises:
  bf16-size:
    type: mcq
    devices: [phone, desktop]
    prompt: How many bytes does one bf16 number take?
    options: ["1", "2", "4", "8"]
    answer: 1
    explanation: bf16 is 16 bits = 2 bytes.
---

## Bits on a budget

Every weight is stored in some number format...

<Exercise id="bf16-size" />

## Why it matters

Bytes are what you pay for twice...
```

| Frontmatter field | Type | Notes |
| --- | --- | --- |
| `title` | string | required |
| `kind` | `lesson` \| `boss` | default `lesson`. Boss lessons must contain a `boss` exercise and show a skull on the map |
| `summary` | string | one line in lesson lists |
| `xp` | int 0-1000 | base payout on first completion. Each exercise solved first try adds a $10 bonus, once |
| `minutes` | int | optional. Otherwise estimated from words (180 wpm) plus 45s per exercise |
| `keyIdeas` | string[3] | exactly three. They are the MISSION PASSED recap |
| `exercises` | map of id to exercise | ids are kebab-case. Every exercise must be placed in the body exactly once |

Body rules, enforced by the validator:

- Each `## Heading` starts a new card. A card holds at most **170 words** (code fences don't count). Aim for about 120.
- `# ` headings are not allowed, and text can't appear before the first card heading.
- `<Exercise id="..." />` goes on its own line between cards. Text after an exercise needs its own `## ` heading.
- Cards are GitHub-flavoured markdown with tables, fenced code and KaTeX math (`$x$`, `$$...$$`). Arbitrary JSX is
  **not** supported. `<Exercise />` is the only tag.

### Exercise reference

Every exercise needs `type`, `devices` (a non-empty subset of `[phone, desktop]`) and `explanation` (shown with the
feedback). The rest depends on the type.

| `type` | Fields | Phone? |
| --- | --- | --- |
| `mcq` | `prompt`, `options` (2-6), `answer` (0-based index) | yes |
| `fill` | optional `prompt`, `text` with blanks `{{0}}`, `{{1}}`..., `chips` (2-10, distractors welcome), `answers` (the chip for each blank, in blank order) | yes |
| `ordering` | `prompt`, `items` (3-8, listed in the **correct** order; the widget shuffles them) | yes (tap to swap; drag on desktop) |
| `predict` | `prompt`, `answer` (number), optional `tolerance` `{mode: relative\|absolute, value}` (default relative 0.05), `unit`, `hint` | yes. Accepts `1.3k`, `2 GB`, `4e9`, `131,072` |
| `simulator` | `sim` (registry id), `prompt`, optional `params` (initial slider values), `locked` (slider ids to hide), `goal` `{output, op: lt\|lte\|gt\|gte\|between, value, max?, description}` | yes |
| `stepper` | `prompt`, `frames` (2+), each `{caption, view}`. A view is `tokens` `{tokens, highlight?, dim?, label?}`, `matrix` `{rows, cols, cells (number or null for masked), highlight? [[r,c]], label?}` or `bars` `{bars: [{label, value, tone?}], unit?, max?, label?}` | yes |
| `code` | `language: python`, `prompt`, `starter`, `tests`, `solution`, optional `hints` | desktop only in practice |
| `debug` | `mode: line` with `code` and `bugLine` (1-based; the learner taps the buggy line), or `mode: code` with `code`, `tests` and `solution` (the learner fixes it). Plus `language: python` and `prompt` | `line` mode works on phones |
| `boss` | `title`, `briefing`, `timeLimit` (20-900 s), `playerHp` (1-6, default 3), `parts` (2-8 `mcq` / `fill` / `ordering` / `predict` exercises without `devices`) | yes, if every part is |

**Hidden tests** for `code` and code-mode `debug` are plain Python: define `test_*` functions that `assert`. They run in
the same namespace as the learner's code. An assertion message becomes the feedback text:

```python
def test_sums_to_one():
    p = softmax([1.0, 2.0, 3.0])
    assert abs(sum(p) - 1) < 1e-6, "probabilities should sum to 1"
```

With `python3` installed, `validate-content` checks that every `solution` passes its tests and that the `starter`
(or the buggy `code`) does not.

### Simulators

Simulators are pure TypeScript models in `src/lib/sims/index.ts`. This is the one part of a course that is code: a new
kind of simulator needs a new entry there. Existing ones can be reused by any course:

| `sim` | Slider ids (for `params` / `locked`) | Output ids (for `goal.output`) |
| --- | --- | --- |
| `sampling` | `temperature`, `topK`, `topP` | `topProb`, `entropy`, `candidates` |
| `attention-cost` | `seqLen`, `heads`, `headDim` | `scoresGB`, `attnTflop` |
| `kv-cache` | `layers`, `kvHeads`, `headDim`, `kvBytes`, `seqLen`, `batch`, `paramsB`, `gpuGB` | `kvPerTokenKB`, `kvPerSeqGB`, `kvTotalGB`, `weightsGB`, `totalGB`, `budgetGB`, `maxBatch` |
| `roofline` | `gpu`, `batch`, `weightBytes`, `paramsB` | `intensity`, `ridge`, `attainable`, `utilisation`, `computeBound`, `tokensPerSec` |

The validator rejects unknown sims, slider ids, output ids and out-of-range slider values. Option sliders (`kvBytes`,
`gpuGB`, `gpu`, `weightBytes`) only accept one of their listed values.

## Extension points

### Progress storage

```ts
interface ProgressStore {
  load(): Promise<ProgressState>;
  save(state: ProgressState): Promise<void>;
  clear(): Promise<void>;
  subscribe?(onChange: (state: ProgressState) => void): () => void;
}
```

`LocalProgressStore` (localStorage key `inference-academy:progress:v1`) is what the app uses. `MemoryProgressStore`
is for tests. All XP, streak, level and respect rules are pure functions in `src/lib/progress/logic.ts`, so a Supabase
store only needs to persist and merge `ProgressState`. `migrate()` upgrades older saved shapes.

### Code runners

```ts
interface CodeRunner {
  readonly id: string;
  readonly languages: readonly ("python" | "cpp")[];
  prepare?(): Promise<void>;
  run(req: { language; code; tests; timeoutMs? }): Promise<{ error; stdout; tests: TestResult[]; durationMs }>;
  dispose?(): void;
}
```

- `PyodideRunner` loads Pyodide from the jsDelivr CDN inside `public/workers/pyodide-worker.js`. The worker starts
  only when a code exercise mounts. Runs time out after 8 seconds, and the worker is then killed and restarted, so
  `while True:` can't hang the tab.
- `PistonRunner` (`src/lib/runner/piston-runner.ts`) posts to a [Piston](https://github.com/engineer-man/piston)
  `/api/v2/execute` endpoint. It wraps the code with the same Python harness the browser uses, which prints one
  `__IA_RESULTS__` JSON line. It is not wired up yet. To use it:
  `registerRunner("cpp", () => new PistonRunner("https://your-piston"))`, plus a C++ test harness.

## Deploying to Vercel

The app is a standard Next.js App Router project, and every course page is prerendered at build time.

1. Push the repo to GitHub, GitLab or Bitbucket.
2. In Vercel, **Add New → Project**, import the repo, and keep the detected **Next.js** preset. The defaults work:
   `npm install`, `npm run build`.
3. Deploy. There are no environment variables or secrets.

The CLI works too: `npx vercel` for a preview, `npx vercel --prod` for production. Adding or editing a course is a
content commit, which redeploys.

Learners' browsers fetch Pyodide from `cdn.jsdelivr.net`. If you add a Content-Security-Policy, allow that origin for
`script-src` and `connect-src`, and `'wasm-unsafe-eval'`.
