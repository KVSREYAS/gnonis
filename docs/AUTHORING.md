# Authoring courses

Courses live in `content/courses/<course-slug>/`. Prose is MDX. Exercises are components. Progress ids are written by hand and never derived from a title or a file number.

```
content/courses/my-course/
  course.yaml
  lessons/
    01-hello.mdx
    02-boss-hello.mdx
  assets/
```

Check a pack with `npm run validate:content`. In dev, saving a file under `content/` reloads the open lesson. `/preview/<course>/<lesson>` plays a lesson without saving progress. The lesson segment can be the authoring slug (`hello`) or the URL slug.

`npm run convert:legacy` rewrites a pack that still has `modules/` into this layout. It keeps lesson and exercise ids, mission briefings, and diagram images, and it leaves flat-only lessons in place. Safe to re-run.

## Add a course

`course.yaml`:

```yaml
id: my-course
title: My course
description: One paragraph.
order: 10
cover: skyline          # art name, or a file under the course such as assets/cover.svg
prerequisites: []       # other course ids
lessons:
  - hello
tagline: One line on the card.
level: intro            # intro | intermediate | advanced
```

`id` is the progress id for the course. Use the folder name. `lessons` lists authoring slugs (the part after `nn-` in the filename), in play order.

Optional `districts` keep the map. Each district is a module: `id`, `title`, `district`, `summary`, `tip`, `art`, `status` (`ready` or `stub`), and `lessons`. Ready districts need lessons. Stubs list none. The course `lessons` array must equal the ready districts' lists, in order. Omit `districts` and the loader builds one district called Missions.

URLs stay `/courses/<folder>/<district-id>/<lesson-url-slug>`. For a lesson whose id is `my-course/01-intro/01-hello`, the URL slug is `01-hello`, so old links keep working. The authoring slug in `course.yaml` is `hello`.

## Add a lesson

`lessons/03-hello.mdx`. The `nn-` prefix is only the filename order on disk. The id inside the file is what progress uses.

```mdx
---
id: my-course/missions/01-hello
title: Hello
estMinutes: 5
xp: 30
missionIntro: One line for the map and the intro.
keyIdeas:
  - First thing to remember.
  - Second.
  - Third.
---

## Mission briefing

Two short paragraphs. A card is at most 170 words.

<MCQ
  id="what-next"
  prompt="What comes next?"
  options={["A walk", "Another card"]}
  answer={1}
  explanation="Cards and exercises alternate."
/>
```

Required frontmatter: `id`, `title`, `estMinutes` (1-90), `xp`, `missionIntro`. Optional: `kind: boss` (the lesson must contain a `<Boss />`) and `keyIdeas` (up to six; the mission-passed screen lists them).

`id` is lowercase segments separated by `/` or `-`. Write the full progress id. Do not compute it from the title.

Body rules:

- `## Heading` starts a card. `#` headings are rejected. Text before the first card, or after an exercise, needs its own `##` card.
- Exercise tags are self-closing and sit between cards. Props are JS literals (strings, numbers, arrays, objects). No function calls and no template interpolation.
- The tag is the type. Do not also set `type`.
- `id` on the tag is the exercise id, kebab-case, unique in the lesson. The progress key is `<lesson id>#<exercise id>`.
- `devices` defaults to phone and desktop. Set `devices={["desktop"]}` for a keyboard mission.
- Diagrams stay in `public/diagrams` and are ordinary markdown images: `![alt](/diagrams/my-course/hello.png)`. Every png under `public/diagrams` must be referenced, and every referenced image must exist.

## Add an exercise type

1. Create `src/exercises/<type>/schema.ts` with a Zod object whose `type` literal is the kebab-case name, plus `devices`.
2. Create `src/exercises/<type>/renderer.tsx`. Export a client `Renderer` that takes `WidgetProps`. Put the main button in the action bar with `usePrimaryAction`. Give phone players a tap path (buttons) wherever a drag is the fast path.
3. Add one `defineExercise({ type, tag, label, schema })` line in `src/exercises/registry.ts`. The tag is the PascalCase component authors write.
4. Register the renderer in `src/exercises/renderer.tsx`.

Put one example in `content/courses/sample-bits-bytes/lessons/03-field-kit.mdx` so the type is exercised.

Shipped tags: `MCQ`, `Fill`, `Ordering`, `Predict`, `Simulator`, `Stepper`, `Code`, `Debug`, `Boss`, `PredictReveal`, `Envelope`, `Trace`, `DragSort`, `SpotBug`, `Parsons`, `CodeBlanks`, `SliderDiagram`.

## Code exercises

`Code` takes `language="python"` or `language="cpp"`. Both languages share the same fields:

| Field | Role |
| --- | --- |
| `starter` | What the editor opens with. It must fail at least one hidden test. |
| `tests` | Hidden tests. Submit grades these. The field name stays `tests` so existing Python exercises keep their content hash. |
| `visibleTests` | Optional sample tests, same format as `tests`. Run shows them. Leave the prop off when there are no samples. |
| `solution` | Reference solution. `validate:content` runs it. The browser never receives it. |
| `hints` | Shown one at a time. |
| `explanation` | Shown after every hidden test passes. |

The progress key is still `<lesson id>#<exercise id>`. A new `language` or a new `visibleTests` prop does not rename that key. Keep the exercise id when you add samples to an existing Python puzzle.

**Run** and **Submit** are separate.

- **Run samples** executes `visibleTests` and saves nothing.
- **Run input** executes the program with the custom stdin box and saves nothing. Python skips `test_*` functions in this mode. C++ compiles the program once and feeds that stdin.
- **Submit** runs the hidden `tests`. The lesson records completion only when every hidden test passes. A preview lesson still saves nothing.

`Debug` stays Python-only and keeps a single Submit that grades its hidden tests.

### Python

Hidden and visible tests are Python source. Define `test_*` functions with `assert`. The harness runs the learner's code, then those functions, in Pyodide in the browser (and in CPython during `validate:content`). The docstring is the test name.

```jsx
<Code
  id="add-py"
  language="python"
  prompt="Write add(a, b)."
  starter={"def add(a, b):\n    return 0\n"}
  visibleTests={"def test_sample():\n    \"\"\"two plus three\"\"\"\n    assert add(2, 3) == 5\n"}
  tests={"def test_neg():\n    \"\"\"negatives\"\"\"\n    assert add(-4, 10) == 6\n"}
  solution={"def add(a, b):\n    return a + b\n"}
  explanation="Addition."
/>
```

Python hidden tests still ship to the browser, because grading happens there. Write them as checks, and keep the explanation for the idea.

### C++

The component and prop names are the same ones Python uses: `language="cpp"`, `starter`, `visibleTests`, `tests`, `solution`, `hints`, plus `prompt`, `explanation`, `id`, and `devices`.

```jsx
<Code
  id="add-two"
  language="cpp"
  prompt="Write add(a, b) for two 64-bit integers."
  starter={"long long add(long long a, long long b) {\n    return 0;\n}\n"}
  visibleTests={"#include \"check.h\"\n\nint main() {\n    CHECK(add(2, 3) == 5);\n    return 0;\n}\n"}
  tests={"#include \"check.h\"\n\nint main() {\n    CHECK(add(-4, 10) == 6);\n    CHECK(add(2000000000LL, 2000000000LL) == 4000000000LL);\n    return 0;\n}\n"}
  solution={"long long add(long long a, long long b) {\n    return a + b;\n}\n"}
  hints={["The tests already define main and CHECK. You only write add."]}
  explanation="One translation unit. The last check needs a 64-bit sum."
/>
```

**Run samples** compiles `starter` (whatever is in the editor) and `visibleTests` together. **Submit** compiles the editor and hidden `tests` together. Neither run is saved until Submit and every hidden check passes. **Run input** compiles the editor by itself and feeds the custom stdin box. It saves nothing. Use it when the learner's file has its own `main`.

The compiler is x86-64 `g++ -std=c++20 -O2` (diagnostics also pass `-fdiagnostics-color=never`). x86-64 is required: exercises may `#include <emmintrin.h>` and use SSE2, which is baseline on that architecture. A compiler whose `-dumpmachine` is not `x86_64*` refuses the run and says so. Vercel Sandbox in `iad1` is x86-64. Build the g++ snapshot on an x86-64 machine.

The learner's code and the test file are one translation unit, in that order, so the tests call the learner's functions directly. The learner does not define `main`. The test file does. The runner writes a harness header, `check.h`, and includes it before the learner's code. Tests may also `#include "check.h"`. Include guards make the second include a no-op.

```cpp
#ifndef GNOSIS_CHECK_H
#define GNOSIS_CHECK_H
#include <cstdio>
#include <cstdlib>
#define CHECK(cond) \
  do { \
    if (!(cond)) { \
      std::fprintf(stderr, "%s:%d: CHECK failed: %s\n", __FILE__, __LINE__, #cond); \
      std::exit(1); \
    } \
  } while (0)
#endif
```

`CHECK` prints `file:line` and the expression, then exits 1. The first failing check stops the program. Exit code 0 means every check passed, and the report is `1/1 passed`. Any other exit is `0/1`, with that line in the message. `#line` directives name the learner file `solution.cpp` and the test file `tests.cpp`, so the numbers match the sources you wrote.

The browser never receives hidden `tests` or `solution`. Submit looks them up by lesson id and exercise id.

Limits, on each run: source 24 KB, tests 48 KB, custom stdin 8 KB, stdout 8 KB, stderr 4 KB, compile wall 10 s, run wall 3 s, CPU 2 s (`ulimit -t`), address space 512 MiB (`ulimit -v`). A timeout or a crash fails the run.

The worked exercise is `add-two` in `content/courses/sample-bits-bytes/lessons/03-field-kit.mdx`. Its starter returns 0, so the hidden checks fail. The solution returns `a + b` as `long long`.

`npm run validate:content` compiles each C++ reference solution and starter with the system `g++` when it is on `PATH` and targets x86-64. The solution must exit 0 on the hidden tests and on any visible tests. The starter must fail at least one hidden check. If `g++` is missing, the check prints a warning and continues. `--no-cpp` skips it. CI on `ubuntu-latest` is x86-64 and has `g++`, so the reference run happens there. The Vercel Sandbox is what learners hit in production.

A local dev server with no Vercel OIDC token shows a clear message on the exercise and leaves Run and Submit disabled until sign-in and the sandbox are available. See the README for the migration, the snapshot, and the daily cap.

## Ids, renames, and answer changes

`npm run validate:content` fails if a course, lesson, or exercise id that exists on `origin/main` disappears. List a deliberate removal in `content/retired-ids.yaml`. List a rename in `content/renames.yaml` (`courses`, `lessons`, `exercises`, old id to new id). On read, progress keys are rewritten through that map, including a course-prefix rewrite.

Each exercise stores a hash of its answer-bearing fields next to the attempt. A wording fix does not change the hash. An answer change marks the exercise **Updated** and keeps the old attempt until the learner solves the new version. Code and debug solutions are stripped before they reach the browser. The hash is computed first.

Fetch `origin/main` before validating. CI checks out full history and fetches `refs/heads/main` into `origin/main`. `CONTENT_BASELINE_REF` overrides the ref. `CONTENT_SKIP_BASELINE=1` skips the diff for a local fixture. When that ref is missing, or when `VERCEL` is set (Vercel’s shallow checkout has no `origin/main`), only the progress-id diff is skipped, with a warning. Schema, registry, retired-id, and rename checks still run.
