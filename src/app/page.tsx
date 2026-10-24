import { Scene } from "@/components/art";
import { CourseCard } from "@/components/course-card";
import { getCourses } from "@/lib/content/loader";
import { summarizeCourse } from "@/lib/content/types";

const TIPS = [
  "Decode at batch size 1 is a race against memory bandwidth, not FLOPs.",
  "The KV cache, not the weights, usually decides how many users fit on a GPU.",
  "Every lesson card is about two minutes. Every district ends with a boss.",
];

export default function Home() {
  const courses = getCourses().map(summarizeCourse);
  return (
    <div className="flex flex-1 flex-col">
      <section className="relative isolate overflow-hidden border-b border-border">
        <Scene art="skyline" className="absolute inset-0 -z-10 h-full w-full" />
        <div className="decor absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
        <div className="mx-auto max-w-6xl px-4 pt-16 pb-10 sm:px-6 sm:pt-28 sm:pb-14">
          <div className="max-w-2xl rounded-xl bg-ink/90 p-5 sm:p-7">
            <p className="text-sm font-bold tracking-widest text-gold-ink uppercase">Gnosis</p>
            <h1 className="mt-1 font-display text-5xl leading-[0.95] tracking-wide text-foreground sm:text-7xl">
              LEARN HOW MODELS <span className="text-gold-ink">ACTUALLY RUN</span>
            </h1>
            <p className="mt-4 max-w-[60ch] text-lg text-foreground">
              Short cards, instant feedback, real numbers. Go from tokens and attention to KV caches and rooflines, one mission at a time.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12" aria-labelledby="packs">
        <h2 id="packs" className="font-display text-3xl tracking-wide text-foreground">
          CHOOSE A MISSION PACK
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {courses.map((c) => (
            <CourseCard key={c.slug} course={c} />
          ))}
        </div>
        <p className="mt-8 border-t border-border pt-4 text-base text-muted-foreground">
          <span className="font-display tracking-widest text-gold-ink">TIP:</span> {TIPS[0]}
        </p>
      </section>
    </div>
  );
}
