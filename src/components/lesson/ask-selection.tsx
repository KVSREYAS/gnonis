"use client";

import { useEffect, useState } from "react";
import type { Device } from "@/lib/content/schema";

export function readLessonSelection(): { text: string; rect: DOMRect } | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const text = selection.toString().replace(/\s+/g, " ").trim();
  if (text.length < 2) return null;
  const node = selection.anchorNode;
  const element = node instanceof Element ? node : node?.parentElement;
  if (!element?.closest("[data-lesson-content]")) return null;
  if (element.closest("[data-dive-panel], [data-ask-chip], input, textarea, select, [contenteditable='true']")) return null;
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { text: text.slice(0, 500), rect };
}

export function AskSelection({
  enabled,
  device,
  chatgptHref,
  onAsk,
}: {
  enabled: boolean;
  device: Device;
  chatgptHref: (text: string) => string;
  onAsk: (text: string) => void;
}) {
  const [chip, setChip] = useState<{ text: string; top: number; left: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const place = () => {
      const found = readLessonSelection();
      if (!found) {
        setChip(null);
        return;
      }
      const width = 280;
      const left = Math.max(8, Math.min(found.rect.left, window.innerWidth - width - 8));
      const top = found.rect.top > 64 ? found.rect.top - 52 : found.rect.bottom + 8;
      setChip({ text: found.text, top, left });
    };
    const hide = () => setChip(null);
    if (device === "phone") {
      document.addEventListener("selectionchange", place);
      document.addEventListener("touchend", place);
      window.addEventListener("scroll", hide, true);
      return () => {
        document.removeEventListener("selectionchange", place);
        document.removeEventListener("touchend", place);
        window.removeEventListener("scroll", hide, true);
      };
    }
    const onMouseUp = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-ask-chip], [data-dive-panel]")) return;
      requestAnimationFrame(place);
    };
    document.addEventListener("mouseup", onMouseUp);
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("scroll", hide, true);
    };
  }, [device, enabled]);

  if (!chip) return null;

  return (
    <div
      data-ask-chip
      className="fixed z-50 flex max-w-[90vw] items-center gap-1 rounded-full border border-gold/70 bg-ink p-1 shadow-lg"
      style={{ top: chip.top, left: chip.left }}
      onPointerDown={(event) => event.preventDefault()}
    >
      <button
        type="button"
        className="tap rounded-full bg-gold px-3 text-sm font-bold text-ink"
        data-testid="ask-chip"
        onClick={() => {
          onAsk(chip.text);
          window.getSelection()?.removeAllRanges();
          setChip(null);
        }}
      >
        Ask about this
      </button>
      <a
        href={chatgptHref(chip.text)}
        target="_blank"
        rel="noreferrer"
        className="tap inline-flex items-center rounded-full px-3 text-sm font-bold text-gold-ink"
        aria-label="Go deeper in ChatGPT"
        data-testid="ask-chatgpt"
      >
        ChatGPT
      </a>
    </div>
  );
}
