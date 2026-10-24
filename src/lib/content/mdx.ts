/**
 * Lesson bodies are MDX: prose split into cards by `##` headings, with self-closing exercise
 * components between cards. Props are JS literals (strings, numbers, arrays, objects), not code.
 */

export const MAX_CARD_WORDS = 170;

export type BodyBlock =
  | { kind: "card"; title: string; markdown: string; words: number }
  | { kind: "exercise"; id: string };

export type ParsedExercise = {
  id: string;
  tag: string;
  props: Record<string, unknown>;
  line: number;
};

export type ParsedLesson = {
  blocks: BodyBlock[];
  exercises: ParsedExercise[];
  errors: string[];
};

class LiteralParser {
  i = 0;
  constructor(private readonly s: string) {}

  eof() {
    return this.i >= this.s.length;
  }

  peek() {
    return this.s[this.i];
  }

  rest() {
    return this.s.slice(this.i, this.i + 24);
  }

  skip() {
    while (!this.eof()) {
      const c = this.peek();
      if (c === " " || c === "\n" || c === "\r" || c === "\t") {
        this.i++;
        continue;
      }
      if (c === "/" && this.s[this.i + 1] === "/") {
        while (!this.eof() && this.peek() !== "\n") this.i++;
        continue;
      }
      if (c === "/" && this.s[this.i + 1] === "*") {
        this.i += 2;
        while (!this.eof() && !(this.peek() === "*" && this.s[this.i + 1] === "/")) this.i++;
        this.i = Math.min(this.s.length, this.i + 2);
        continue;
      }
      return;
    }
  }

  parseValue(): unknown {
    this.skip();
    const c = this.peek();
    if (c === '"') return this.string('"');
    if (c === "'") return this.string("'");
    if (c === "`") return this.template();
    if (c === "[") return this.array();
    if (c === "{") return this.object();
    if (c === "-" || (c >= "0" && c <= "9")) return this.number();
    if (this.keyword("true")) return true;
    if (this.keyword("false")) return false;
    if (this.keyword("null")) return null;
    throw new Error(`unexpected ${JSON.stringify(this.rest())}`);
  }

  private keyword(word: string) {
    if (!this.s.startsWith(word, this.i)) return false;
    const next = this.s[this.i + word.length];
    if (next && /[A-Za-z0-9_]/.test(next)) return false;
    this.i += word.length;
    return true;
  }

  string(quote: string) {
    this.i++;
    let out = "";
    while (!this.eof()) {
      const c = this.s[this.i++];
      if (c === quote) return out;
      if (c === "\\") out += this.escape();
      else out += c;
    }
    throw new Error("unterminated string");
  }

  private template() {
    this.i++;
    let out = "";
    while (!this.eof()) {
      const c = this.s[this.i++];
      if (c === "`") return out;
      if (c === "$" && this.peek() === "{") throw new Error("template interpolation is not allowed; use a JSON string");
      if (c === "\\") out += this.escape();
      else out += c;
    }
    throw new Error("unterminated template");
  }

  private escape() {
    const c = this.s[this.i++] ?? "";
    const map: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "\\": "\\", '"': '"', "'": "'", "`": "`", "/": "/" };
    if (c in map) return map[c];
    if (c === "u") {
      const hex = this.s.slice(this.i, this.i + 4);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new Error("bad unicode escape");
      this.i += 4;
      return String.fromCharCode(parseInt(hex, 16));
    }
    return c;
  }

  private number() {
    const m = this.s.slice(this.i).match(/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (!m) throw new Error("bad number");
    this.i += m[0].length;
    return Number(m[0]);
  }

  private array() {
    this.i++;
    const out: unknown[] = [];
    this.skip();
    if (this.peek() === "]") {
      this.i++;
      return out;
    }
    while (!this.eof()) {
      out.push(this.parseValue());
      this.skip();
      if (this.peek() === ",") {
        this.i++;
        this.skip();
        if (this.peek() === "]") {
          this.i++;
          return out;
        }
        continue;
      }
      if (this.peek() === "]") {
        this.i++;
        return out;
      }
      throw new Error("expected , or ]");
    }
    throw new Error("unterminated array");
  }

  private object() {
    this.i++;
    const out: Record<string, unknown> = {};
    this.skip();
    if (this.peek() === "}") {
      this.i++;
      return out;
    }
    while (!this.eof()) {
      this.skip();
      const key = this.peek() === '"' || this.peek() === "'" ? this.string(this.peek()) : this.ident();
      this.skip();
      if (this.peek() !== ":") throw new Error("expected :");
      this.i++;
      out[key] = this.parseValue();
      this.skip();
      if (this.peek() === ",") {
        this.i++;
        this.skip();
        if (this.peek() === "}") {
          this.i++;
          return out;
        }
        continue;
      }
      if (this.peek() === "}") {
        this.i++;
        return out;
      }
      throw new Error("expected , or }");
    }
    throw new Error("unterminated object");
  }

  ident() {
    const m = this.s.slice(this.i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (!m) throw new Error(`expected a name near ${JSON.stringify(this.rest())}`);
    this.i += m[0].length;
    return m[0];
  }
}

export function parseJsLiteral(source: string): unknown {
  const p = new LiteralParser(source);
  const value = p.parseValue();
  p.skip();
  if (!p.eof()) throw new Error(`trailing content near ${JSON.stringify(p.rest())}`);
  return value;
}

export function parseJsxAttributes(source: string): Record<string, unknown> {
  const p = new LiteralParser(source);
  const out: Record<string, unknown> = {};
  while (true) {
    p.skip();
    if (p.eof()) return out;
    const name = p.ident();
    p.skip();
    if (p.peek() !== "=") {
      out[name] = true;
      continue;
    }
    p.i++;
    p.skip();
    const c = p.peek();
    if (c === "{") {
      p.i++;
      out[name] = p.parseValue();
      p.skip();
      if (p.peek() !== "}") throw new Error(`unclosed { on ${name}`);
      p.i++;
    } else if (c === '"' || c === "'") {
      out[name] = p.string(c);
    } else {
      throw new Error(`expected a value for ${name}`);
    }
  }
}

function lineOf(source: string, index: number) {
  return source.slice(0, index).split("\n").length;
}

function isFenceLine(source: string, index: number) {
  const start = source.lastIndexOf("\n", index - 1) + 1;
  const end = source.indexOf("\n", index);
  const line = source.slice(start, end === -1 ? source.length : end);
  return /^\s*```/.test(line);
}

type Span = { start: number; end: number; tag: string; attrs: string; line: number };

function readTag(source: string, start: number, tag: string): Span {
  let i = start + 1 + tag.length;
  let brace = 0;
  let quote: '"' | "'" | "`" | null = null;
  const attrStart = i;
  while (i < source.length) {
    const c = source[i];
    if (quote) {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (quote === "`" && c === "$" && source[i + 1] === "{") throw new Error("template interpolation is not allowed in exercise props");
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      i++;
      continue;
    }
    if (c === "{") {
      brace++;
      i++;
      continue;
    }
    if (c === "}") {
      brace = Math.max(0, brace - 1);
      i++;
      continue;
    }
    if (brace === 0 && c === "/" && source[i + 1] === ">") {
      return { start, end: i + 2, tag, attrs: source.slice(attrStart, i), line: lineOf(source, start) };
    }
    if (brace === 0 && c === ">") throw new Error(`<${tag}> must be self-closing`);
    i++;
  }
  throw new Error(`unclosed <${tag}>`);
}

function findExercises(body: string, tags: readonly string[]): { spans: Span[]; errors: string[] } {
  const spans: Span[] = [];
  const errors: string[] = [];
  const tagSet = new Set(tags);
  let fence = false;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "\n" || i === 0) {
      const at = body[i] === "\n" ? i + 1 : 0;
      if (isFenceLine(body, at)) fence = !fence;
    }
    if (fence || body[i] !== "<") continue;
    const prev = i === 0 ? "" : body[i - 1];
    if (prev && !/\s/.test(prev)) continue;
    const name = body.slice(i + 1).match(/^[A-Z][A-Za-z0-9]*/);
    if (!name) continue;
    if (!tagSet.has(name[0])) {
      errors.push(`line ${lineOf(body, i)}: unknown exercise component <${name[0]}>`);
      continue;
    }
    try {
      const span = readTag(body, i, name[0]);
      spans.push(span);
      i = span.end - 1;
    } catch (e) {
      errors.push(`line ${lineOf(body, i)}: ${(e as Error).message}`);
    }
  }
  return { spans, errors };
}

function cardsFrom(body: string, exercises: ParsedExercise[]): { blocks: BodyBlock[]; errors: string[] } {
  const blocks: BodyBlock[] = [];
  const errors: string[] = [];
  let current: { title: string; lines: string[] } | null = null;
  let inFence = false;

  const flush = () => {
    if (!current) return;
    const markdown = current.lines.join("\n").trim();
    const words = markdown.replace(/```[\s\S]*?```/g, " ").split(/\s+/).filter(Boolean).length;
    if (!markdown) errors.push(`card "${current.title}" is empty`);
    if (words > MAX_CARD_WORDS) errors.push(`card "${current.title}" has ${words} words (max ${MAX_CARD_WORDS})`);
    blocks.push({ kind: "card", title: current.title, markdown, words });
    current = null;
  };

  for (const line of body.split("\n")) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const marker = !inFence && line.trim().match(/^@@EX:(\d+)@@$/);
    if (marker) {
      flush();
      const ex = exercises[Number(marker[1])];
      if (ex) blocks.push({ kind: "exercise", id: ex.id });
      continue;
    }
    if (!inFence && /^##\s+/.test(line)) {
      flush();
      current = { title: line.replace(/^##\s+/, "").trim(), lines: [] };
      continue;
    }
    if (!inFence && /^#\s+/.test(line)) {
      errors.push(`use "## " for card titles; "# " is reserved (line: ${line.trim()})`);
      continue;
    }
    if (current) current.lines.push(line);
    else if (line.trim())
      errors.push(
        blocks.length
          ? `text after an exercise needs its own "## " card heading: "${line.trim().slice(0, 40)}"`
          : `text before the first "## " card heading: "${line.trim().slice(0, 40)}"`,
      );
  }
  if (inFence) errors.push("unclosed code fence");
  flush();
  return { blocks, errors };
}

/** Split a lesson body into cards and exercise components. `tags` is the registry's component names. */
export function parseLessonSource(body: string, tags: readonly string[]): ParsedLesson {
  const errors: string[] = [];
  const { spans, errors: scanErrors } = findExercises(body, tags);
  errors.push(...scanErrors);

  const exercises: ParsedExercise[] = [];
  let shadowed = "";
  let cursor = 0;
  spans.forEach((span, index) => {
    shadowed += body.slice(cursor, span.start);
    shadowed += `\n@@EX:${index}@@\n`;
    cursor = span.end;
    try {
      const props = parseJsxAttributes(span.attrs);
      const id = props.id;
      if (typeof id !== "string" || !/^[a-z0-9-]+$/.test(id)) {
        errors.push(`line ${span.line}: <${span.tag}> needs id="kebab-case"`);
        return;
      }
      if ("type" in props) errors.push(`line ${span.line}: do not set type on <${span.tag}>; the tag is the type`);
      const { id: _id, ...rest } = props;
      void _id;
      exercises[index] = { id, tag: span.tag, props: rest, line: span.line };
    } catch (e) {
      errors.push(`line ${span.line}: <${span.tag}> props: ${(e as Error).message}`);
    }
  });
  shadowed += body.slice(cursor);

  const cards = cardsFrom(shadowed, exercises);
  return { blocks: cards.blocks, exercises, errors: [...errors, ...cards.errors] };
}
