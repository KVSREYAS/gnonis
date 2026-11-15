import { isOutputLang, languageLabel, shouldNumberLines } from "@/lib/highlight-parse";
import { cn } from "@/lib/utils";

/** Static, already-highlighted fence. `html` is Shiki output (trusted). */
export function CodeFrame({ html, lang, lineCount }: { html: string; lang: string; lineCount: number }) {
  const output = isOutputLang(lang);
  return (
    <figure
      className={cn("gnosis-code", output && "gnosis-code-output", shouldNumberLines(lang, lineCount) && "gnosis-code-lines")}
      data-language={lang}
    >
      <figcaption>{languageLabel(lang)}</figcaption>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </figure>
  );
}
