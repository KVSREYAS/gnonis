"use client";

import { useState, type ComponentType } from "react";
import { Gamepad2 } from "lucide-react";
import type { ExerciseOf } from "@/lib/content/schema";
import { GAME_CONFIGS, type GameId } from "@/lib/games/configs";
import { seedFrom } from "@/lib/games/rng";
import { Prompt } from "@/components/widgets/inline-text";
import type { WidgetProps } from "@/components/widgets/types";
import { usePrimaryAction } from "@/components/widgets/useAction";
import { ECON_GAMES } from "./econ-games";
import { GT_GAMES } from "./gt-games";
import { Note, type GameProps, type GameResult } from "./ui";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GAMES: Record<GameId, ComponentType<GameProps<any>>> = { ...GT_GAMES, ...ECON_GAMES };

const TITLES: Record<GameId, string> = {
  "pd-match": "Prisoner's dilemma",
  "pd-tournament": "Strategy tournament",
  "nash-hunt": "Nash hunt",
  dominance: "Delete the dominated",
  ultimatum: "Ultimatum game",
  "beauty-contest": "Guess 2/3 of the average",
  auction: "Sealed-bid auction",
  centipede: "Centipede game",
  "game-tree": "Backward induction",
  "penalty-kicks": "Penalty kicks",
  "monty-hall": "Monty Hall",
  coordination: "Think like the crowd",
  "hawk-dove": "Hawks and doves",
  market: "Market maker",
  lemonade: "Lemonade stand",
  elasticity: "Elastic or not",
  compound: "Compounding race",
  "central-bank": "Run the central bank",
  commons: "Fishing commons",
  "comparative-advantage": "Trade puzzle",
  monopoly: "Monopoly pricing",
  lemons: "Used-car market",
};

export function GameWidget({ id, exercise, setAction, onGrade, locked }: WidgetProps<ExerciseOf<"game">>) {
  const [seed] = useState(() => (seedFrom(id) ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const [result, setResult] = useState<GameResult | null>(null);
  const Game = GAMES[exercise.game];
  const cfg = GAME_CONFIGS[exercise.game].parse(exercise.config ?? {});

  usePrimaryAction(
    setAction,
    locked
      ? null
      : result
        ? {
            label: result.won ? "Bank the win" : "Submit result",
            onPress: () => onGrade({ correct: result.won, message: `${result.summary} ${exercise.explanation}` }),
          }
        : { label: "Finish the game first", disabled: true, onPress: () => {} },
  );

  return (
    <div data-testid={`game-${exercise.game}`}>
      <p className="mb-1 flex items-center gap-2 font-display text-sm tracking-widest text-gold-ink">
        <Gamepad2 className="size-4" aria-hidden /> {TITLES[exercise.game].toUpperCase()}
      </p>
      <Prompt text={exercise.prompt} />
      <Game id={id} cfg={cfg} seed={seed} locked={locked || !!result} onDone={setResult} />
      {result && !locked && <Note tone={result.won ? "good" : "bad"}>{result.summary}</Note>}
    </div>
  );
}
