import type { Device } from "@/lib/content/schema";
import type { Grade } from "@/lib/grading";

export type PrimaryAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
};

/**
 * Contract between the lesson player and every widget. The widget renders its own UI, puts its
 * main action (Check / Run / Next) into the player's thumb-reach action bar via setAction, and
 * reports a grade exactly once per attempt via onGrade.
 */
export type WidgetProps<E> = {
  id: string;
  exercise: E;
  device: Device;
  setAction: (a: PrimaryAction | null) => void;
  onGrade: (g: Grade) => void;
  /** True once graded; widgets should freeze input and reveal answers. */
  locked: boolean;
};
