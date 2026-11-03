import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small "Fun 3/5" badge. Renders nothing when the lesson has no rating. */
export function FunBadge({ fun, className }: { fun?: number | null; className?: string }) {
  if (!fun) return null;
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded border border-border px-1.5 text-sm text-muted-foreground tabular-nums", className)}
      title="Fun meter: 1 is dense theory, 5 is hands-on coding or a surprising result"
      aria-label={`Fun ${fun} out of 5`}
      data-testid="fun-badge"
    >
      <Sparkles className="size-3.5 text-gold-ink" aria-hidden /> Fun {fun}/5
    </span>
  );
}
