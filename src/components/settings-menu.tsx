"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useAuth, useDevice, useProgress, useSettings } from "@/components/providers";
import { levelForXp } from "@/lib/progress/logic";
import type { Settings } from "@/lib/settings";
import { cn } from "@/lib/utils";

function Row({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-2">
      <label htmlFor={htmlFor} className="flex flex-col">
        <span className="text-base font-bold text-foreground">{label}</span>
        {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg border border-border bg-ink p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-10 rounded-md px-3 text-sm font-bold",
            value === o.value ? "bg-gold text-ink" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsMenu() {
  const { settings, update } = useSettings();
  const device = useDevice();
  const { state, reset, cloud } = useProgress();
  const { configured } = useAuth();
  const [confirmReset, setConfirmReset] = useState(false);
  const lvl = levelForXp(state.xp);

  return (
    <Dialog onOpenChange={() => setConfirmReset(false)}>
      <DialogTrigger render={<Button variant="ghost" size="icon" aria-label="Open menu" data-testid="menu-button" />}>
        <Menu className="size-6" />
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto bg-panel sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wide text-gold-ink">PAUSE MENU</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Level {lvl.level}, {lvl.rank}. {lvl.span - lvl.into} XP to the next level.
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y divide-border">
          <Row label="Reader mode" hint="Bigger text, no art or animation" htmlFor="reader-switch">
            <Switch id="reader-switch" checked={settings.reader} onCheckedChange={(v) => update({ reader: v })} />
          </Row>
          <Row label="Light mode" hint="Dark text on a light page" htmlFor="light-switch">
            <Switch
              id="light-switch"
              checked={settings.theme === "light"}
              onCheckedChange={(v) => update({ theme: v ? "light" : "dark" })}
            />
          </Row>
          <div className="py-3">
            <p className="mb-2 text-base font-bold">Motion</p>
            <Segmented<Settings["motion"]>
              label="Motion"
              value={settings.motion}
              onChange={(motion) => update({ motion })}
              options={[
                { value: "system", label: "System" },
                { value: "reduced", label: "Reduced" },
                { value: "full", label: "Full" },
              ]}
            />
          </div>
          <div className="py-3">
            <p className="mb-1 text-base font-bold">Device mode</p>
            <p className="mb-2 text-sm text-muted-foreground">
              Phone mode shows only phone-friendly exercises. Desktop missions wait for a keyboard. Now: <strong>{device}</strong>.
            </p>
            <Segmented<Settings["device"]>
              label="Device mode"
              value={settings.device}
              onChange={(d) => update({ device: d })}
              options={[
                { value: "auto", label: "Auto" },
                { value: "phone", label: "Phone" },
                { value: "desktop", label: "Desktop" },
              ]}
            />
          </div>
          <div className="py-3">
            <p className="mb-1 text-base font-bold">Save file</p>
            <p className="mb-2 text-sm text-muted-foreground">
              {cloud ? (
                "Progress is saved to your account. Resetting wipes it on every device you're signed in on."
              ) : configured ? (
                <>
                  Progress is stored on this device only.{" "}
                  <Link href="/login" className="font-bold text-gold-ink underline underline-offset-4">
                    Sign in
                  </Link>{" "}
                  to sync it between devices.
                </>
              ) : (
                "Progress is stored on this device only."
              )}
            </p>
            {confirmReset ? (
              <div className="flex gap-2">
                <Button variant="destructive" onClick={() => { reset(); setConfirmReset(false); }}>
                  Yes, wipe progress
                </Button>
                <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setConfirmReset(true)}>
                Reset progress
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
