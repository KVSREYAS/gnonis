"use client";

import { useEffect, useRef, useState } from "react";
import { byteHint, CalcError, evaluateExpression, formatCalcValue } from "@/lib/calc/parse";

const HISTORY_KEY = "gnosis:calc:v1";
const UNITS = ["KB", "MB", "GB", "TB"] as const;

type Entry = { expr: string; result: string };

function loadHistory(): Entry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Entry => !!item && typeof item.expr === "string" && typeof item.result === "string")
      .slice(-30);
  } catch {
    return [];
  }
}

export function Calculator({ active, focusToken = 0 }: { active: boolean; focusToken?: number }) {
  const [expr, setExpr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [history, setHistory] = useState<Entry[]>(() => loadHistory());
  const [cursor, setCursor] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasActive = useRef(false);
  const seenToken = useRef(focusToken);

  useEffect(() => {
    const opened = active && !wasActive.current;
    const asked = focusToken !== seenToken.current;
    wasActive.current = active;
    seenToken.current = focusToken;
    if (active && (opened || asked)) inputRef.current?.focus();
  }, [active, focusToken]);

  const remember = (entry: Entry) => {
    setHistory((prev) => {
      const next = [...prev, entry].slice(-30);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* private mode */
      }
      return next;
    });
  };

  const run = () => {
    try {
      const value = evaluateExpression(expr);
      const result = formatCalcValue(value);
      setCurrent(result);
      setHint(byteHint(value));
      setError(null);
      setCursor(-1);
      remember({ expr: expr.trim(), result });
    } catch (err) {
      setCurrent(null);
      setHint(null);
      setError(err instanceof CalcError ? err.message : "I couldn't work that out.");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Powers, parentheses, sqrt, log, ln. Units: KB MB GB TB and KiB MiB GiB TiB.{" "}
        <span className="whitespace-nowrap">Ctrl/Cmd+Shift+K</span> focuses this box.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          run();
        }}
      >
        <input
          ref={inputRef}
          value={expr}
          onChange={(event) => {
            setExpr(event.target.value);
            setCursor(-1);
          }}
          onKeyDown={(event) => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
            if (!history.length) return;
            event.preventDefault();
            const next = event.key === "ArrowUp" ? Math.min(history.length - 1, cursor + 1) : Math.max(-1, cursor - 1);
            setCursor(next);
            setExpr(next === -1 ? "" : history[history.length - 1 - next].expr);
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          enterKeyHint="go"
          placeholder="2*7e9*2/1e9"
          aria-label="Calculator expression"
          data-testid="calc-input"
          className="h-12 min-w-0 flex-1 rounded-lg border border-input bg-ink px-3 font-mono text-base text-foreground outline-none focus-visible:border-gold"
        />
        <button
          type="submit"
          className="tap rounded-lg bg-gold px-4 font-bold text-ink"
          data-testid="calc-run"
        >
          =
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        {UNITS.map((unit) => (
          <button
            key={unit}
            type="button"
            className="tap rounded-lg border border-border bg-panel-2 px-3 text-sm font-bold text-foreground"
            onClick={() => {
              setExpr((prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}${unit}`);
              inputRef.current?.focus();
            }}
          >
            {unit}
          </button>
        ))}
      </div>
      <div className="min-h-14 rounded-lg border border-border bg-ink px-3 py-2" aria-live="polite" data-testid="calc-result">
        {error ? (
          <p className="text-base text-danger">{error}</p>
        ) : current ? (
          <>
            <p className="font-mono text-2xl text-money-ink">{current}</p>
            {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
          </>
        ) : (
          <p className="text-base text-muted-foreground">Result shows up here.</p>
        )}
      </div>
      {history.length > 0 && (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {[...history].reverse().map((entry, index) => (
            <li key={`${entry.expr}-${index}`}>
              <button
                type="button"
                className="w-full rounded-lg px-2 py-2 text-left font-mono text-sm text-foreground hover:bg-panel-2"
                onClick={() => {
                  setExpr(entry.expr);
                  setError(null);
                  inputRef.current?.focus();
                }}
              >
                <span className="text-muted-foreground">{entry.expr}</span>
                <span className="text-gold-ink"> = {entry.result}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
