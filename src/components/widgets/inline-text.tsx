import { Fragment } from "react";

/** Renders `code` and **bold** spans in short widget strings (prompts, options, explanations). */
export function InlineText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("`") && p.endsWith("`") && p.length > 2)
          return (
            <code key={i} className="rounded bg-panel-2 px-1 py-0.5 font-mono text-[0.9em]">
              {p.slice(1, -1)}
            </code>
          );
        if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={i}>{p.slice(2, -2)}</strong>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

export function Prompt({ text }: { text: string }) {
  return (
    <p className="mb-4 text-[1.0625rem] leading-relaxed font-bold text-foreground">
      <InlineText text={text} />
    </p>
  );
}
