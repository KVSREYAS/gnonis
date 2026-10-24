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

## Ids, renames, and answer changes

`npm run validate:content` fails if a course, lesson, or exercise id that exists on `origin/main` disappears. List a deliberate removal in `content/retired-ids.yaml`. List a rename in `content/renames.yaml` (`courses`, `lessons`, `exercises`, old id to new id). On read, progress keys are rewritten through that map, including a course-prefix rewrite.

Each exercise stores a hash of its answer-bearing fields next to the attempt. A wording fix does not change the hash. An answer change marks the exercise **Updated** and keeps the old attempt until the learner solves the new version. Code and debug solutions are stripped before they reach the browser. The hash is computed first.

Fetch `origin/main` before validating. CI does this. `CONTENT_BASELINE_REF` overrides the ref. `CONTENT_SKIP_BASELINE=1` skips the diff for a local fixture.
