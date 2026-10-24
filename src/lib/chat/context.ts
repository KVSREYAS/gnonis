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
    case "predict-reveal":
      return bullets([
        exercise.prompt,
        exercise.unit ? `Unit: ${exercise.unit}` : "",
        "The learner guesses on a slider, then a chart is revealed. The expected number and the chart values are not included here.",
      ]);
    case "envelope":
      return bullets([
        exercise.prompt,
        "Facts already on screen:",
        ...exercise.given,
        "More hints appear one at a time. Those hints and the target number are not included here.",
      ]);
    case "trace":
      return bullets([
        exercise.prompt,
        exercise.code,
        `Question on screen: ${exercise.question}`,
        "The learner steps through the snippet. Step notes and the expected answer are not included here.",
      ]);
    case "drag-sort":
      return bullets([
        exercise.prompt,
        "Sort these. The list below is alphabetical, not the solution.",
        ...[...exercise.items].sort((a, b) => a.localeCompare(b)),
      ]);
    case "spot-bug":
      return bullets([
        exercise.prompt,
        "The learner is looking for the buggy line. The line number is not included here.",
        exercise.code,
      ]);
    case "parsons":
      return bullets([
        exercise.prompt,
        "Rebuild the snippet. The lines below are alphabetical, not the solution.",
        ...[...exercise.lines].sort((a, b) => a.localeCompare(b)),
      ]);
    case "code-blanks":
      return bullets([
        exercise.prompt,
        "Fill the blanks in this snippet. The expected text for each blank is not included here.",
        exercise.code.replace(/\{\{\d+\}\}/g, "____"),
      ]);
    case "slider-diagram":
      return bullets([
        exercise.prompt,
        `Horizontal axis: ${exercise.xLabel}`,
        `Vertical axis: ${exercise.yLabel}`,
        exercise.unit ? `Unit: ${exercise.unit}` : "",
        `Goal on screen: ${exercise.goal.description}`,
        "The curve samples and the numeric target are not included here.",
      ]);
    default: {
      const unreachable: never = exercise;
      return unreachable;
    }
  }
}
