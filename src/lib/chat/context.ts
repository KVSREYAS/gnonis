import type { Exercise } from "@/lib/content/schema";

function bullets(lines: string[]): string {
  return lines.filter(Boolean).join("\n");
}

export function exerciseTitle(exercise: Exercise): string {
  if (exercise.type === "boss") return exercise.title;
  return exercise.prompt?.trim() || exercise.type;
}

/** What the learner can already see, without the answer key, solution, or hidden tests. */
export function exerciseBrief(exercise: Exercise): string {
  switch (exercise.type) {
    case "mcq":
      return bullets([
        "Multiple choice. The correct option is not included here.",
        exercise.prompt,
        ...exercise.options.map((option, index) => `${index + 1}. ${option}`),
      ]);
    case "fill":
      return bullets([
        exercise.prompt ?? "",
        "Fill the blanks. Which chip belongs in which blank is not included here.",
        exercise.text.replace(/\{\{\d+\}\}/g, "____"),
        `Chips: ${exercise.chips.join(", ")}`,
      ]);
    case "ordering":
      return bullets([
        exercise.prompt,
        "Put these in order. The list below is alphabetical, not the solution.",
        ...[...exercise.items].sort((a, b) => a.localeCompare(b)),
      ]);
    case "predict":
      return bullets([
        exercise.prompt,
        exercise.unit ? `Unit: ${exercise.unit}` : "",
        exercise.hint ? `Hint on screen: ${exercise.hint}` : "",
        "The expected number is not included here.",
      ]);
    case "simulator":
      return bullets([
        exercise.prompt,
        `Simulator: ${exercise.sim}`,
        exercise.goal ? `Goal on screen: ${exercise.goal.description}` : "",
      ]);
    case "stepper":
      return bullets([
        exercise.prompt,
        "Frames are revealed one at a time. Captions:",
        ...exercise.frames.map((frame, index) => `${index + 1}. ${frame.caption}`),
      ]);
    case "code":
      return bullets([
        exercise.prompt,
        "Starter code:",
        exercise.starter,
        exercise.hints.length ? `Hints already offered: ${exercise.hints.join(" / ")}` : "",
        "Hidden tests and the reference solution are not included here.",
      ]);
    case "debug":
      return bullets([
        exercise.prompt,
        exercise.mode === "line" ? "The learner is looking for the buggy line. The line number is not included here." : "The learner has to fix this code. Tests and the solution are not included here.",
        exercise.code,
      ]);
    case "boss":
      return bullets([
        exercise.title,
        exercise.briefing,
        `Timed boss fight with ${exercise.parts.length} parts, shown one at a time. Part answers are not included here.`,
      ]);
  }
}
