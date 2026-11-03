import type { Art } from "@/lib/content/schema";
import { cn } from "@/lib/utils";


/** Plain decorative background: a dark gradient with a faint grid. No scenery. `art` is kept for API compatibility. */
export function Scene({ art = "skyline", className }: { art?: Art; className?: string }) {
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMax slice" className={cn("decor block", className)} aria-hidden focusable="false" data-art={art}>
      <defs>
        <linearGradient id="ia-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <pattern id="ia-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="#334155" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="400" height="240" fill="url(#ia-bg)" />
      <rect width="400" height="240" fill="url(#ia-grid)" opacity="0.6" />
    </svg>
  );
}
