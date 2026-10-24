"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Globe, Square, Trash2 } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { loadChat, saveChat } from "@/lib/chat/storage";
import { questionFromMessage, type TutorContext } from "@/lib/chat/prompt";
import { cn } from "@/lib/utils";

export type Quote = { id: string; text: string };

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function safeHttpUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.toString();
  } catch {
    /* ignore */
  }
  return null;
}

export function DiveChat({
  lessonKey,
  context,
  quotes,
  onRemoveQuote,
  onClearQuotes,
  draft,
  onDraft,
  model,
  signedIn,
  accountsConfigured,
  loginHref,
  active,
  onLatestQuestion,
}: {
  lessonKey: string;
  context: TutorContext;
  quotes: Quote[];
  onRemoveQuote: (id: string) => void;
  onClearQuotes: () => void;
  draft: string;
  onDraft: (value: string) => void;
  /** Allowlisted id, or "" to let the server apply OPENROUTER_MODEL. */
  model: string;
  signedIn: boolean;
  accountsConfigured: boolean;
  loginHref: string;
  active: boolean;
  onLatestQuestion: (question: string) => void;
}) {
  const [web, setWeb] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const wasActive = useRef(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        credentials: "same-origin",
        body: () => ({
          web,
          context,
          ...(model ? { model } : {}),
        }),
      }),
    [context, model, web],
  );

  const { messages, sendMessage, status, error, stop, setMessages, clearError } = useChat({
    id: lessonKey,
    messages: loadChat(window.localStorage, lessonKey),
    transport,
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (busy) return;
    saveChat(window.localStorage, lessonKey, messages);
  }, [busy, lessonKey, messages]);

  useEffect(() => {
    const last = [...messages].reverse().find((message) => message.role === "user");
    onLatestQuestion(last ? questionFromMessage(messageText(last)) : "");
  }, [messages, onLatestQuestion]);

  useEffect(() => {
    const node = scrollerRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, status]);

  useEffect(() => {
    if (active && !wasActive.current) inputRef.current?.focus();
    wasActive.current = active;
  }, [active]);

  const submit = () => {
    const question = draft.trim();
    if (!question || busy || !signedIn) return;
    const quoted = quotes.map((quote) => `> ${quote.text}`).join("\n>\n");
    const text = quoted ? `${quoted}\n\n${question}` : question;
    clearError();
    void sendMessage(
      { text },
      {
        body: {
          web,
          context,
          ...(model ? { model } : {}),
        },
      },
    );
    onDraft("");
    onClearQuotes();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={web}
          title="Look up docs on the web. Off keeps the chat cheap."
          data-testid="chat-web"
          onClick={() => setWeb((on) => !on)}
          className={cn(
            "tap inline-flex items-center gap-1.5 rounded-lg border px-3 text-sm font-bold",
            web ? "border-gold bg-gold text-ink" : "border-border bg-panel-2 text-foreground",
          )}
        >
          <Globe className="size-4" aria-hidden />
          Web {web ? "on" : "off"}
        </button>
        <button
          type="button"
          data-testid="chat-clear"
          className="tap ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-muted-foreground hover:text-foreground"
          onClick={() => {
            if (!confirmClear) {
              setConfirmClear(true);
              return;
            }
            setMessages([]);
            saveChat(window.localStorage, lessonKey, []);
            setConfirmClear(false);
            clearError();
          }}
        >
          <Trash2 className="size-4" aria-hidden />
          {confirmClear ? "Clear chat?" : "Clear"}
        </button>
      </div>
      {web && <p className="text-sm text-muted-foreground">Web lookups are capped separately, and each one also uses a daily message.</p>}

      <div ref={scrollerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1" data-testid="chat-log">
        {!signedIn && (
          <p className="rounded-lg border border-gold/50 bg-ink p-3 text-base text-foreground">
            {accountsConfigured ? (
              <>
                Sign in to ask the tutor.{" "}
                <a href={loginHref} className="font-bold text-gold-ink underline">
                  Sign in
                </a>
              </>
            ) : (
              "Chat needs a signed-in account, and this copy of Gnosis is running without accounts."
            )}
          </p>
        )}
        {messages.length === 0 && signedIn && (
          <p className="text-base text-muted-foreground">Ask about this step. Highlight a sentence and it comes along as a quote.</p>
        )}
        {messages.map((message) => {
          const text = messageText(message);
          const sources = message.parts.filter((part) => part.type === "source-url");
          return (
            <article key={message.id} className={cn("rounded-lg px-3 py-2", message.role === "user" ? "bg-panel-2" : "bg-ink")}>
              <p className="mb-1 font-display text-sm tracking-widest text-gold-ink">{message.role === "user" ? "YOU" : "TUTOR"}</p>
              {message.role === "assistant" ? (
                <div className="chat-md">{text ? <Markdown source={text} /> : busy ? <p className="text-muted-foreground">Working…</p> : null}</div>
              ) : (
                <p className="text-base whitespace-pre-wrap text-foreground">{text}</p>
              )}
              {sources.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-border pt-2">
                  {sources.map((part) => {
                    if (part.type !== "source-url") return null;
                    const href = safeHttpUrl(part.url);
                    if (!href) return null;
                    let host = href;
                    try {
                      host = new URL(href).hostname.replace(/^www\./, "");
                    } catch {
                      /* keep the raw url */
                    }
                    return (
                      <li key={part.sourceId}>
                        <a href={href} target="_blank" rel="noreferrer" className="text-sm font-bold text-gold-ink underline">
                          {part.title?.trim() || host}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          );
        })}
        {busy && messages.at(-1)?.role !== "assistant" && <p className="text-base text-muted-foreground">Working…</p>}
        {error && (
          <p className="rounded-lg border border-danger/60 bg-ink p-3 text-base text-foreground" role="status" data-testid="chat-error">
            {error.message || "The tutor hit a snag. Try again in a moment."}
          </p>
        )}
      </div>

      {quotes.length > 0 && (
        <ul className="flex max-h-28 flex-col gap-1 overflow-y-auto" data-testid="chat-quotes">
          {quotes.map((quote) => (
            <li key={quote.id} className="flex items-start gap-2 rounded-lg border border-gold/40 bg-ink px-2 py-1">
              <p className="line-clamp-3 min-w-0 flex-1 text-sm text-foreground">“{quote.text}”</p>
              <button type="button" className="tap shrink-0 text-sm font-bold text-muted-foreground" aria-label="Remove highlight" onClick={() => onRemoveQuote(quote.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder={signedIn ? "Ask about this step" : "Sign in to ask"}
          disabled={!signedIn}
          aria-label="Question"
          data-testid="chat-input"
          className="max-h-36 min-h-12 flex-1 resize-none rounded-lg border border-input bg-ink px-3 py-2 text-base text-foreground outline-none focus-visible:border-gold disabled:opacity-60"
        />
        {busy ? (
          <button type="button" className="tap rounded-lg border border-border px-3 font-bold text-foreground" onClick={() => stop()} aria-label="Stop">
            <Square className="size-4" aria-hidden />
          </button>
        ) : (
          <button type="submit" className="tap rounded-lg bg-gold px-4 font-bold text-ink disabled:opacity-50" disabled={!signedIn || !draft.trim()} data-testid="chat-send">
            Send
          </button>
        )}
      </form>
    </div>
  );
}
