import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { EMPTY_RENAMES, type RenameMap } from "@/lib/progress/rename-map";

const id = z.string().min(1);
const map = z.record(id, id).default({});

export const RenameFileSchema = z
  .object({
    courses: map,
    lessons: map,
    exercises: map,
  })
  .strict();

export const RetiredFileSchema = z
  .object({
    courses: z.array(id).default([]),
    lessons: z.array(id).default([]),
    exercises: z.array(id).default([]),
  })
  .strict();

export type RetiredIds = z.infer<typeof RetiredFileSchema>;

export const EMPTY_RETIRED: RetiredIds = { courses: [], lessons: [], exercises: [] };

function readYamlFile(file: string): unknown {
  if (!fs.existsSync(file)) return {};
  return YAML.parse(fs.readFileSync(file, "utf8")) ?? {};
}

let renameCache: RenameMap | undefined;

export function getRenameMap(file = path.join(process.cwd(), "content", "renames.yaml")): RenameMap {
  if (renameCache && file === path.join(process.cwd(), "content", "renames.yaml")) return renameCache;
  const parsed = RenameFileSchema.parse(readYamlFile(file));
  const map = { courses: parsed.courses, lessons: parsed.lessons, exercises: parsed.exercises };
  if (process.env.NODE_ENV === "production" && file === path.join(process.cwd(), "content", "renames.yaml")) renameCache = map;
  return map;
}

export function getRetiredIds(file = path.join(process.cwd(), "content", "retired-ids.yaml")): RetiredIds {
  const parsed = RetiredFileSchema.parse(readYamlFile(file));
  return { courses: parsed.courses, lessons: parsed.lessons, exercises: parsed.exercises };
}

export function emptyRenames(): RenameMap {
  return EMPTY_RENAMES;
}
