import type { Metadata } from "next";
import { CourseCard } from "@/components/course-card";
import { courseIndexLinks } from "@/lib/content/navigation";
import { getCourses } from "@/lib/content/loader";
import { summarizeCourse } from "@/lib/content/types";

export const metadata: Metadata = { title: "Courses" };

export default function CoursesIndexPage() {
  const courses = getCourses().map(summarizeCourse);
  const links = courseIndexLinks(courses);
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-12" aria-labelledby="course-index">
      <h1 id="course-index" className="font-display text-4xl tracking-wide text-foreground">
        MISSION PACKS
      </h1>
      <p className="mt-2 max-w-[60ch] text-base text-muted-foreground">Every course in this build. Open one to see its districts.</p>
      {links.length === 0 ? (
        <p className="mt-6 text-base text-muted-foreground" data-testid="course-index-empty">
          No courses are available.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2" data-testid="course-index">
          {courses.map((course) => (
            <CourseCard key={course.slug} course={course} />
          ))}
        </div>
      )}
    </section>
  );
}
