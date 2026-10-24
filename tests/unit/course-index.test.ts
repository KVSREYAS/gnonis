import { describe, expect, it } from "vitest";
import { getCourses } from "@/lib/content/loader";
import { courseHref, courseIndexLinks } from "@/lib/content/navigation";

describe("course index", () => {
  it("lists every course pack with a /courses link", () => {
    const courses = getCourses();
    expect(courses.map((course) => course.slug)).toEqual(["llm-inference", "sample-bits-bytes"]);
    const links = courseIndexLinks(courses);
    expect(links).toEqual([
      { slug: "llm-inference", href: "/courses/llm-inference" },
      { slug: "sample-bits-bytes", href: "/courses/sample-bits-bytes" },
    ]);
    expect(links.map((link) => link.href)).toEqual(courses.map((course) => courseHref(course.slug)));
    for (const course of courses) {
      expect(course.modules.some((mod) => mod.lessons.length > 0)).toBe(true);
    }
  });
});
