import { z } from "zod";
import { DeviceSchema, type Device } from "./device";
import { bossPartSchema, type BossPart, ExerciseSchema, type Exercise, type ExerciseOf, type ExerciseType, EXERCISE_TYPES, type FrameView, type SimGoal } from "@/exercises/schema";

export { DeviceSchema, type Device };
export { ExerciseSchema, EXERCISE_TYPES, type BossPart, type Exercise, type ExerciseOf, type ExerciseType, type FrameView, type SimGoal };
export { bossPartSchema };

const text = z.string().trim().min(1);

export const LessonFrontmatterSchema = z
  .object({
    /** Stable progress id. Written by hand. Never computed from the title or the file's number. */
    id: z.string().regex(/^[a-z0-9]+(?:[\/-][a-z0-9]+)*$/, "lesson ids are lowercase path segments"),
    title: text,
    estMinutes: z.number().int().positive().max(90),
    xp: z.number().int().min(0).max(1000),
    missionIntro: text,
    kind: z.enum(["lesson", "boss"]).default("lesson"),
    keyIdeas: z.array(text).min(1).max(6).optional(),
  })
  .strict();
export type LessonFrontmatter = z.infer<typeof LessonFrontmatterSchema>;

export const ArtSchema = z.enum(["skyline", "docks", "hills", "grid", "bridge", "desert", "pier", "tower"]);
export type Art = z.infer<typeof ArtSchema>;

const slug = z.string().regex(/^[a-z0-9-]+$/);

export const DistrictSchema = z
  .object({
    id: slug,
    title: text,
    district: text,
    summary: text,
    tip: text,
    art: ArtSchema.default("skyline"),
    status: z.enum(["ready", "stub"]).default("ready"),
    lessons: z.array(slug).default([]),
  })
  .strict()
  .superRefine((m, ctx) => {
    if (m.status === "ready" && m.lessons.length === 0)
      ctx.addIssue({ code: "custom", path: ["lessons"], message: "ready districts need at least one lesson" });
    if (m.status === "stub" && m.lessons.length > 0)
      ctx.addIssue({ code: "custom", path: ["lessons"], message: "stub districts must not list lessons" });
    if (new Set(m.lessons).size !== m.lessons.length)
      ctx.addIssue({ code: "custom", path: ["lessons"], message: "duplicate lesson slug" });
  });
export type DistrictMeta = z.infer<typeof DistrictSchema>;

export const CourseSchema = z
  .object({
    id: slug,
    title: text,
    description: text,
    order: z.number().int().default(100),
    /** An art name (skyline, docks, ...) or a path under the course, like assets/cover.svg. */
    cover: text,
    prerequisites: z.array(slug).default([]),
    lessons: z.array(slug).default([]),
    tagline: text.optional(),
    level: z.enum(["intro", "intermediate", "advanced"]).default("intermediate"),
    districts: z.array(DistrictSchema).optional(),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (new Set(c.lessons).size !== c.lessons.length) ctx.addIssue({ code: "custom", path: ["lessons"], message: "duplicate lesson slug" });
    if (c.prerequisites.includes(c.id)) ctx.addIssue({ code: "custom", path: ["prerequisites"], message: "a course cannot require itself" });
    if (!c.districts) return;
    if (new Set(c.districts.map((d) => d.id)).size !== c.districts.length)
      ctx.addIssue({ code: "custom", path: ["districts"], message: "duplicate district id" });
    const flat = c.districts.filter((d) => d.status === "ready").flatMap((d) => d.lessons);
    if (flat.length !== c.lessons.length || flat.some((slug, i) => slug !== c.lessons[i]))
      ctx.addIssue({
        code: "custom",
        path: ["lessons"],
        message: "lessons must match the ready districts' lesson lists, in order",
      });
    const seen = new Set<string>();
    for (const d of c.districts)
      for (const lesson of d.lessons) {
        if (seen.has(lesson)) ctx.addIssue({ code: "custom", path: ["districts"], message: `lesson "${lesson}" is in more than one district` });
        seen.add(lesson);
        if (!c.lessons.includes(lesson))
          ctx.addIssue({ code: "custom", path: ["districts"], message: `district lesson "${lesson}" is not in lessons` });
      }
  });
export type CourseMeta = z.infer<typeof CourseSchema>;
