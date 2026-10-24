import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CourseMap } from "@/components/course-map";
import { getCourse, getCourses } from "@/lib/content/loader";
import { summarizeCourse } from "@/lib/content/types";

export const dynamicParams = false;

export function generateStaticParams() {
  return getCourses().map((c) => ({ course: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/courses/[course]">): Promise<Metadata> {
  const { course } = await params;
  return { title: getCourse(course)?.title ?? "Course" };
}

export default async function CoursePage({ params }: PageProps<"/courses/[course]">) {
  const { course: slug } = await params;
  const course = getCourse(slug);
  if (!course) notFound();
  return <CourseMap course={summarizeCourse(course)} />;
}
