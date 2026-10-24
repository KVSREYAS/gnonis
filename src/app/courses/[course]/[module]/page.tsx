import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModuleIntro } from "@/components/module-intro";
import { getCourse, getCourses } from "@/lib/content/loader";
import { summarizeCourse } from "@/lib/content/types";

export const dynamicParams = false;

export function generateStaticParams() {
  return getCourses().flatMap((c) => c.modules.filter((m) => m.status === "ready").map((m) => ({ course: c.slug, module: m.slug })));
}

export async function generateMetadata({ params }: PageProps<"/courses/[course]/[module]">): Promise<Metadata> {
  const { course, module } = await params;
  return { title: getCourse(course)?.modules.find((m) => m.slug === module)?.title ?? "District" };
}

export default async function ModulePage({ params }: PageProps<"/courses/[course]/[module]">) {
  const { course: cslug, module: mslug } = await params;
  const course = getCourse(cslug);
  const summary = course && summarizeCourse(course);
  const mod = summary?.modules.find((m) => m.slug === mslug);
  if (!course || !mod || mod.status !== "ready") notFound();
  return <ModuleIntro courseSlug={course.slug} courseTitle={course.title} mod={mod} />;
}
