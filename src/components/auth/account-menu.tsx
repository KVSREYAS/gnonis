"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Cloud, CloudOff, Loader2, LogOut, RefreshCw, UserRound } from "lucide-react";
import { useAuth, useProgress } from "@/components/providers";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { SyncStatus } from "@/lib/progress/supabase-store";
import { cn } from "@/lib/utils";

const STATUS: Record<SyncStatus, { label: string; tone: string; Icon: typeof Cloud }> = {
  idle: { label: "Saved to your account.", tone: "text-money-ink", Icon: Cloud },
  synced: { label: "Saved to your account.", tone: "text-money-ink", Icon: Cloud },
  pending: { label: "Saving to your account…", tone: "text-muted-foreground", Icon: RefreshCw },
  syncing: { label: "Saving to your account…", tone: "text-muted-foreground", Icon: RefreshCw },
  offline: { label: "Offline. Progress is saved on this device and syncs when you're back online.", tone: "text-gold-ink", Icon: CloudOff },
  error: { label: "Can't reach the save server. Progress is saved on this device and will retry.", tone: "text-gold-ink", Icon: CloudOff },
};

function initials(name: string) {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Header account control: nothing in local-only mode, "Sign in" for guests, a player card when signed in. */
export function AccountMenu() {
  const { configured, ready, user, signOut } = useAuth();
  const { syncStatus, flush } = useProgress();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  if (!configured) return null;
  if (!ready) return <span className="size-11" aria-hidden />;

  if (!user) {
    const next = pathname && pathname !== "/login" ? `?next=${encodeURIComponent(pathname)}` : "";
    return (
      <Link
        href={`/login${next}`}
        className={buttonVariants({ variant: "ghost", size: "icon", className: "gap-1.5 sm:w-auto sm:px-3" })}
        aria-label="Sign in"
        data-testid="signin-link"
      >
        <UserRound className="size-6 sm:size-5" aria-hidden />
        <span className="hidden font-bold sm:inline">Sign in</span>
      </Link>
    );
  }

  const status = STATUS[syncStatus];
  const warn = syncStatus === "offline" || syncStatus === "error";

  async function leave() {
    setBusy(true);
    await flush();
    await signOut();
    setBusy(false);
  }

  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="ghost" size="icon" aria-label={`Account: ${user.name}`} data-testid="account-button" className="relative" />}
      >
        <span className="grid size-8 place-items-center rounded-full border-2 border-gold bg-panel-2 font-display text-sm text-gold-ink" aria-hidden>
          {initials(user.name)}
        </span>
        {warn && <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full border border-ink bg-gold" aria-hidden />}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto bg-panel sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wide text-gold-ink">PLAYER</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">Your save follows you to every device you sign in on.</DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-border">
          <div className="flex items-center gap-3 py-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-gold bg-panel-2 font-display text-lg text-gold-ink" aria-hidden>
              {initials(user.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-bold text-foreground">{user.name}</span>
              {user.email && <span className="block truncate text-base text-muted-foreground">{user.email}</span>}
            </span>
          </div>
          <p className={cn("flex items-start gap-2 py-3 text-base", status.tone)} role="status" data-testid="sync-status">
            <status.Icon className={cn("mt-1 size-4 shrink-0", syncStatus === "syncing" && "animate-spin")} aria-hidden />
            {status.label}
          </p>
          <div className="py-3">
            <Button variant="outline" className="w-full" onClick={leave} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
              Sign out
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
