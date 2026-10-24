const UNITS: Record<string, number> = {
  kb: 1e3,
  mb: 1e6,
  gb: 1e9,
  tb: 1e12,
  kib: 1024,
  mib: 1024 ** 2,
  gib: 1024 ** 3,
  tib: 1024 ** 4,
};

const FUNCTIONS: Record<string, (value: number) => number> = {
  sqrt: (value) => {
    if (value < 0) throw new CalcError("Square root needs a number that isn't negative.");
    return Math.sqrt(value);
  },
  log: (value) => logBase(10, value),
  log10: (value) => logBase(10, value),
  log2: (value) => logBase(2, value),
  ln: (value) => logBase(Math.E, value),
  abs: Math.abs,
};

export class CalcError extends Error {}

type Token =
  | { kind: "num"; value: number }
  | { kind: "id"; value: string }
  | { kind: "op"; value: string }
  | { kind: "eof" };

function logBase(base: number, value: number): number {
  if (value <= 0) throw new CalcError("Log needs a number greater than zero.");
  return Math.log(value) / Math.log(base);
}

function tokenize(input: string): Token[] {
  const source = input.trim();
  if (!source) throw new CalcError("Type an expression, like 2*7e9*2/1e9 or 512 MB.");
  if (source.length > 200) throw new CalcError("That expression is too long.");
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === " " || ch === "\t" || ch === "\n") {
      i += 1;
      continue;
    }
    if (ch === "*" && source[i + 1] === "*") {
      tokens.push({ kind: "op", value: "^" });
      i += 2;
      continue;
    }
    if ("+-*/^(),".includes(ch)) {
      tokens.push({ kind: "op", value: ch });
      i += 1;
      continue;
    }
    if (ch >= "0" && ch <= "9" || ch === ".") {
      const match = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(source.slice(i));
      if (!match) throw new CalcError("I can't read that number.");
      const value = Number(match[0]);
      if (!Number.isFinite(value)) throw new CalcError("That number is too big.");
      tokens.push({ kind: "num", value });
      i += match[0].length;
      continue;
    }
    if ((ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z")) {
      const match = /^[A-Za-z][A-Za-z0-9]*/.exec(source.slice(i));
      if (!match) throw new CalcError("I can't read that name.");
      tokens.push({ kind: "id", value: match[0].toLowerCase() });
      i += match[0].length;
      continue;
    }
    throw new CalcError(`I don't know what to do with "${ch}".`);
  }
  tokens.push({ kind: "eof" });
  return tokens;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): number {
    const value = this.expression();
    if (this.peek().kind !== "eof") throw new CalcError("There's something extra at the end.");
    return this.finish(value);
  }

  private peek(): Token {
    return this.tokens[this.index] ?? { kind: "eof" };
  }

  private eat(): Token {
    const token = this.peek();
    this.index += 1;
    return token;
  }

  private expression(): number {
    let value = this.term();
    for (;;) {
      const token = this.peek();
      if (token.kind === "op" && (token.value === "+" || token.value === "-")) {
        this.eat();
        const right = this.term();
        value = token.value === "+" ? value + right : value - right;
        value = this.finish(value);
      } else break;
    }
    return value;
  }

  private term(): number {
    let value = this.power();
    for (;;) {
      const token = this.peek();
      if (token.kind === "op" && (token.value === "*" || token.value === "/")) {
        this.eat();
        const right = this.power();
        if (token.value === "/" && right === 0) throw new CalcError("Can't divide by zero.");
        value = token.value === "*" ? value * right : value / right;
        value = this.finish(value);
      } else break;
    }
    return value;
  }

  /** Unary minus binds looser than exponentiation, so -2^2 is -4. */
  private power(): number {
    const token = this.peek();
    if (token.kind === "op" && (token.value === "+" || token.value === "-")) {
      this.eat();
      const value = this.power();
      return this.finish(token.value === "-" ? -value : value);
    }
    let value = this.primary();
    const exponent = this.peek();
    if (exponent.kind === "op" && exponent.value === "^") {
      this.eat();
      value = this.finish(value ** this.power());
    }
    return value;
  }

  private primary(): number {
    const token = this.eat();
    if (token.kind === "num") return this.withUnit(token.value);
    if (token.kind === "op" && token.value === "(") {
      const value = this.expression();
      const close = this.eat();
      if (close.kind !== "op" || close.value !== ")") throw new CalcError("Missing a closing parenthesis.");
      return this.withUnit(value);
    }
    if (token.kind === "id") {
      const next = this.peek();
      if (next.kind !== "op" || next.value !== "(") {
        throw new CalcError(`I don't know "${token.value}". Try sqrt, log, ln, or a unit like GB.`);
      }
      const fn = FUNCTIONS[token.value];
      if (!fn) throw new CalcError(`I don't know the function "${token.value}".`);
      this.eat();
      const arg = this.expression();
      const close = this.eat();
      if (close.kind !== "op" || close.value !== ")") throw new CalcError("Missing a closing parenthesis.");
      return this.withUnit(this.finish(fn(arg)));
    }
    throw new CalcError("The expression got cut off.");
  }

  private withUnit(value: number): number {
    const token = this.peek();
    if (token.kind !== "id") return value;
    const scale = UNITS[token.value];
    if (scale == null) throw new CalcError(`I don't know the unit "${token.value}". Use KB, MB, GB, TB, KiB, MiB, GiB, or TiB.`);
    this.eat();
    return this.finish(value * scale);
  }

  private finish(value: number): number {
    if (!Number.isFinite(value)) throw new CalcError("That overflowed.");
    return value;
  }
}

/** Evaluate a calculator expression. Never uses eval. */
export function evaluateExpression(input: string): number {
  return new Parser(tokenize(input)).parse();
}

export function formatCalcValue(value: number): string {
  if (!Number.isFinite(value)) return "undefined";
  const abs = Math.abs(value);
  if (abs !== 0 && (abs >= 1e9 || abs < 1e-4)) {
    return value.toExponential(4).replace(/\.?0+e/, "e").replace("e+", "e");
  }
  const precise = Number(value.toPrecision(12));
  return Object.is(precise, -0) ? "0" : String(precise);
}

/** A second reading of a byte-sized result, using decimal KB/MB/GB/TB. */
export function byteHint(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  const abs = Math.abs(value);
  const units: [number, string][] = [
    [1e12, "TB"],
    [1e9, "GB"],
    [1e6, "MB"],
    [1e3, "KB"],
  ];
  for (const [size, label] of units) {
    if (abs >= size && abs < size * 10_000) return `${formatCalcValue(value / size)} ${label}`;
  }
  return null;
}
