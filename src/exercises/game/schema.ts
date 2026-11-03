import { z } from "zod";
import { GAME_IDS, gameConfigProblems } from "@/lib/games/configs";
import { devicesField, nonEmpty } from "../shared";

export const gameSchema = z
  .object({
    type: z.literal("game"),
    devices: devicesField,
    /** Which mini-game to play. Logic lives in src/lib/games, UI in src/components/games. */
    game: z.enum(GAME_IDS),
    prompt: nonEmpty,
    config: z.record(z.string(), z.unknown()).default({}),
    explanation: nonEmpty,
  })
  .strict()
  .superRefine((ex, ctx) => {
    for (const m of gameConfigProblems(ex.game, ex.config)) ctx.addIssue({ code: "custom", path: ["config"], message: m });
  });
