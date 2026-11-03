import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/lib/content/schema";
import { getCourses } from "@/lib/content/loader";
import { courseHref, courseIndexLinks } from "@/lib/content/navigation";

describe("course index", () => {
  it("lists every course pack with a /courses link", () => {
    const courses = getCourses();
    expect(courses.map((course) => course.slug)).toEqual(["llm-inference", "sample-bits-bytes", "cpp-systems", "economics", "game-theory"]);
    const links = courseIndexLinks(courses);
    expect(links).toEqual([
      { slug: "llm-inference", href: "/courses/llm-inference" },
      { slug: "sample-bits-bytes", href: "/courses/sample-bits-bytes" },
      { slug: "cpp-systems", href: "/courses/cpp-systems" },
      { slug: "economics", href: "/courses/economics" },
      { slug: "game-theory", href: "/courses/game-theory" },
    ]);
    expect(links.map((link) => link.href)).toEqual(courses.map((course) => courseHref(course.slug)));
    for (const course of courses) {
      expect(course.modules.some((mod) => mod.lessons.length > 0)).toBe(true);
    }
  });

  it("puts every course on a homepage shelf", () => {
    const courses = getCourses();
    const by = Object.fromEntries(CATEGORIES.map((c) => [c.id, courses.filter((x) => x.category === c.id).map((x) => x.slug)]));
    expect(by).toEqual({ cs: ["llm-inference", "sample-bits-bytes", "cpp-systems"], economics: ["economics"], "game-theory": ["game-theory"] });
    expect(CATEGORIES.map((c) => c.label)).toEqual(["CS", "Economics", "Game Theory"]);
  });
});
