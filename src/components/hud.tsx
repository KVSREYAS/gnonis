"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { AccountMenu } from "@/components/auth/account-menu";
import { useProgress } from "@/components/providers";
import { SettingsMenu } from "@/components/settings-menu";
import { levelForXp, wantedStars } from "@/lib/progress/logic";
import { cn } from "@/lib/utils";

export function formatMoney(xp: number) {
  return `$${String(Math.max(0, Math.floor(xp))).padStart(8, "0")}`;
}

export function WantedStars({ count, className }: { count: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`Streak: ${count} of 6 wanted stars`}>
      {Array.from({ length: 6 }, (_, i) => (
        <Star
          key={i}
          aria-hidden
          className={cn("size-3.5 sm:size-4", i < count ? "fill-gold text-gold" : "fill-transparent text-muted-foreground/60")}
          strokeWidth={2}
        />
      ))}
    </span>
  );
}

export function Hud() {
  const { state, loaded, streakDays } = useProgress();
  const stars = wantedStars(streakDays);
  const lvl = levelForXp(state.xp);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-ink/95 backdrop-blur supports-[backdrop-filter]:bg-ink/85">
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-3 px-3 sm:h-14 sm:px-5">
        <Link href="/" className="tap flex items-center gap-2 rounded" aria-label="Gnosis home">
          <span className="sunset grid size-8 place-items-center rounded font-display text-lg text-white" aria-hidden>
            GN
          </span>
          <span className="hidden font-display text-lg tracking-wide text-foreground sm:inline">GNOSIS</span>
        </Link>

        <div className="ml-auto flex items-center gap-3 sm:gap-5">
          <span className="hidden items-center gap-2 text-sm text-muted-foreground md:flex" title={`${lvl.into} / ${lvl.span} XP to next level`}>
            <span className="rounded border border-gold/50 px-1.5 font-display text-gold-ink">LV {lvl.level}</span>
            <span>{lvl.rank}</span>
          </span>
          <WantedStars count={stars} />
          <span
            className="font-display text-xl tabular-nums text-money-ink sm:text-2xl"
            aria-label={`${state.xp} XP`}
            data-testid="hud-xp"
            suppressHydrationWarning
          >
            {loaded ? formatMoney(state.xp) : formatMoney(0)}
          </span>
          <span className="flex items-center">
            <AccountMenu />
            <SettingsMenu />
          </span>
        </div>
      </div>
    </header>
  );
}
