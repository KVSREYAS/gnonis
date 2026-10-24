"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { X } from "lucide-react";
import { Calculator } from "@/components/lesson/calculator";
import type { Quote } from "@/components/lesson/dive-chat";
import { CHAT_MODELS, isAllowedModel } from "@/lib/chat/models";
import { studyLinks, type TutorContext } from "@/lib/chat/prompt";
import { MODEL_STORAGE_KEY } from "@/lib/chat/storage";
import { cn } from "@/lib/utils";
import type { Device } from "@/lib/content/schema";

const DiveChat = dynamic(() => import("@/components/lesson/dive-chat").then((mod) => mod.DiveChat), {
  ssr: false,
  loading: () => <p className="text-base text-muted-foreground">Opening the tutor…</p>,
});

function readModel(defaultModel: string): string {
  try {
    const saved = localStorage.getItem(MODEL_STORAGE_KEY);
    if (saved && isAllowedModel(saved)) return saved;
  } catch {
    /* private mode */
  }
  return isAllowedModel(defaultModel) ? defaultModel : "";
}

export function DivePanel({
  device,
  tab,
  onTab,
  onClose,
  lessonKey,
  context,
  quotes,
  onRemoveQuote,
  onClearQuotes,
  draft,
  onDraft,
  defaultModel,
  signedIn,
  accountsConfigured,
  loginHref,
  latestQuestion,
  onLatestQuestion,
  calcFocus,
}: {
  device: Device;
  tab: "chat" | "calc";
  onTab: (tab: "chat" | "calc") => void;
  onClose: () => void;
  lessonKey: string;
  context: TutorContext;
  quotes: Quote[];
  onRemoveQuote: (id: string) => void;
  onClearQuotes: () => void;
  draft: string;
  onDraft: (value: string) => void;
  defaultModel: string;
  signedIn: boolean;
  accountsConfigured: boolean;
  loginHref: string;
  latestQuestion: string;
  onLatestQuestion: (question: string) => void;
  calcFocus: number;
}) {
  const [chatMounted, setChatMounted] = useState(tab === "chat");
  const [model, setModel] = useState(() => readModel(defaultModel));
  if (tab === "chat" && !chatMounted) setChatMounted(true);

  const chooseModel = (value: string) => {
    setModel(value);
    try {
      if (value && isAllowedModel(value)) localStorage.setItem(MODEL_STORAGE_KEY, value);
      else localStorage.removeItem(MODEL_STORAGE_KEY);
    } catch {
      /* private mode */
    }
  };

  const showServerDefault = !isAllowedModel(defaultModel);

  const links = studyLinks({
    courseTitle: context.courseTitle,
    lessonTitle: context.lessonTitle,
    stepTitle: context.stepTitle,
    content: context.stepText,
    selections: quotes.map((quote) => quote.text),
    question: draft.trim() || latestQuestion,
  });

  return (
    <aside
      id="dive-panel"
      data-dive-panel
      data-testid="dive-panel"
      data-layout={device === "phone" ? "sheet" : "drawer"}
      role="complementary"
      aria-label="Dive deeper"
      className={cn(
        "z-[45] flex flex-col border-border bg-panel text-foreground shadow-2xl",
        device === "phone"
          ? "fixed inset-x-0 bottom-0 h-[min(78vh,40rem)] rounded-t-2xl border-t px-3 pt-2"
          : "fixed top-14 right-0 bottom-0 w-[min(100vw,26rem)] border-l px-3 pt-3",
      )}
    >
      <header className="pb-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl tracking-wide text-foreground">DIVE DEEPER</p>
            <p className="text-sm text-muted-foreground">A tutor for the step on screen.</p>
          </div>
          <button type="button" className="tap grid place-items-center rounded-lg text-muted-foreground hover:text-foreground" aria-label="Close dive deeper" onClick={onClose}>
            <X className="size-6" />
          </button>
        </div>
        <label className="mt-2 block text-xs font-bold tracking-widest text-muted-foreground uppercase">
          Model
          <span className="ml-2 font-sans text-xs font-normal tracking-normal normal-case">per 1M tokens, in / out</span>
          <select
            value={model}
            onChange={(event) => chooseModel(event.target.value)}
            data-testid="chat-model"
            className="mt-1 h-11 w-full rounded-lg border border-input bg-ink px-2 text-sm font-sans font-semibold tracking-normal text-foreground normal-case"
          >
            {showServerDefault && <option value="">Server default</option>}
            {CHAT_MODELS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} · {option.price}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <a
          href={links.chatgpt}
          target="_blank"
          rel="noreferrer"
          data-testid="go-chatgpt"
          className="inline-flex h-10 items-center rounded-lg bg-gold px-3 text-sm font-bold text-ink"
        >
          Go deeper in ChatGPT
        </a>
        <a href={links.claude} target="_blank" rel="noreferrer" className="text-sm font-bold text-gold-ink underline">
          Claude
        </a>
        <a href={links.grok} target="_blank" rel="noreferrer" className="text-sm font-bold text-gold-ink underline">
          Grok
        </a>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-ink p-1" role="tablist" aria-label="Dive deeper tools">
        {(
          [
            ["chat", "Chat"],
            ["calc", "Calc"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            data-testid={`dive-tab-${id}`}
            className={cn("h-10 rounded-md text-sm font-bold", tab === id ? "bg-gold text-ink" : "text-muted-foreground")}
            onClick={() => onTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={cn("flex min-h-0 flex-1 flex-col pb-3", device === "phone" && "pb-[max(0.75rem,env(safe-area-inset-bottom))]")}>
        {chatMounted && (
          <div className={cn("min-h-0 flex-1 flex-col", tab === "chat" ? "flex" : "hidden")}>
            <DiveChat
              lessonKey={lessonKey}
              context={context}
              quotes={quotes}
              onRemoveQuote={onRemoveQuote}
              onClearQuotes={onClearQuotes}
              draft={draft}
              onDraft={onDraft}
              model={model}
              signedIn={signedIn}
              accountsConfigured={accountsConfigured}
              loginHref={loginHref}
              active={tab === "chat"}
              onLatestQuestion={onLatestQuestion}
            />
          </div>
        )}
        {tab === "calc" && <Calculator active focusToken={calcFocus} />}
      </div>
    </aside>
  );
}
