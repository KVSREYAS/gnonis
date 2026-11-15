/** Split markdown on fenced code blocks and normalise language tags. No highlighter here. */

export const LINE_NUMBER_MIN = 8;

const ALIASES: Record<string, string> = {
  "c++": "cpp",
  cxx: "cpp",
  cc: "cpp",
  hpp: "cpp",
  h: "c",
  py: "python",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  txt: "text",
  plaintext: "text",
  output: "text",
  out: "text",
  console: "text",
  js: "javascript",
  ts: "typescript",
};

export type MarkdownSegment =
  | { type: "prose"; markdown: string }
  | { type: "code"; lang: string; meta: string; code: string; lineCount: number };

export function resolveLanguage(lang: string | undefined, defaultLanguage?: string): string {
  const raw = (lang ?? "").trim().toLowerCase();
  if (!raw) return defaultLanguage || "text";
  return ALIASES[raw] ?? raw;
}

export function isOutputLang(lang: string): boolean {
  return lang === "text" || lang === "plaintext" || lang === "output";
}

export function shouldNumberLines(lang: string, lineCount: number): boolean {
  return !isOutputLang(lang) && lineCount >= LINE_NUMBER_MIN;
}

export function languageLabel(lang: string): string {
  const labels: Record<string, string> = {
    cpp: "C++",
    c: "C",
    python: "Python",
    bash: "Shell",
    text: "Output",
    plaintext: "Output",
    output: "Output",
    javascript: "JavaScript",
    typescript: "TypeScript",
    json: "JSON",
    yaml: "YAML",
    html: "HTML",
    css: "CSS",
    diff: "Diff",
  };
  return labels[lang] ?? lang;
}

/** Split a markdown string into prose and fenced code segments. */
export function splitMarkdownFences(source: string): MarkdownSegment[] {
  const lines = source.split("\n");
  const segments: MarkdownSegment[] = [];
  let prose: string[] = [];
  let i = 0;

  const flushProse = () => {
    const markdown = prose.join("\n");
    prose = [];
    if (markdown.trim()) segments.push({ type: "prose", markdown });
  };

  while (i < lines.length) {
    const open = lines[i].match(/^(`{3,}|~{3,})(.*)$/);
    if (open) {
      const marker = open[1];
      const info = open[2].trim();
      const close = new RegExp(`^${marker[0]}{${marker.length},}\\s*$`);
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !close.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      flushProse();
      const langToken = info.split(/\s+/, 1)[0] ?? "";
      const meta = info.slice(langToken.length).trim();
      segments.push({ type: "code", lang: langToken, meta, code: body.join("\n"), lineCount: body.length });
      if (i < lines.length) i += 1;
      continue;
    }
    prose.push(lines[i]);
    i += 1;
  }
  flushProse();
  return segments;
}
