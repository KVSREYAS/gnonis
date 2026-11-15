import { createHighlighter, type Highlighter } from "shiki";

const THEMES = ["github-light", "github-dark"] as const;
const LANGS = [
  "cpp",
  "c",
  "python",
  "bash",
  "javascript",
  "typescript",
  "json",
  "jsonc",
  "yaml",
  "toml",
  "html",
  "css",
  "diff",
  "xml",
  "sql",
  "rust",
  "go",
  "plaintext",
] as const;

const SHIKI_LANG: Record<string, string> = {
  text: "plaintext",
  output: "plaintext",
};

let highlighterPromise: Promise<Highlighter> | undefined;

export function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: [...THEMES],
    langs: [...LANGS],
  });
  return highlighterPromise;
}

/** Highlight `code` as `lang` with dual light/dark CSS-variable colours. */
export async function highlightCode(code: string, lang: string): Promise<string> {
  const highlighter = await getHighlighter();
  const wanted = SHIKI_LANG[lang] ?? lang;
  const useLang = (highlighter.getLoadedLanguages() as string[]).includes(wanted) ? wanted : "plaintext";
  return highlighter.codeToHtml(code, {
    lang: useLang,
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  });
}
