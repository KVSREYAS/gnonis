#!/usr/bin/env node
/**
 * Local C++ runner for Gnosis. Zero dependencies: Node 20.9+ is enough.
 *
 *   node local-runner/gnosis-runner.mjs
 *   node local-runner/gnosis-runner.mjs --port 8787
 *
 * Listens on 127.0.0.1 only. Prints a pairing token. The site sends it as
 * `X-Gnosis-Runner-Token`. See the README section "Run C++ on your PC".
 */

import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Must stay in lockstep with src/lib/runner/cpp-harness.ts */
export const LIMITS = {
  code: 24_000,
  tests: 48_000,
  stdin: 8_000,
  stdout: 8_000,
  stderr: 4_000,
  compileMs: 10_000,
  runMs: 3_000,
};

export const CHECK_HEADER = `#ifndef GNOSIS_CHECK_H
#define GNOSIS_CHECK_H
#include <cstdio>
#include <cstdlib>
#define CHECK(cond) \\
  do { \\
    if (!(cond)) { \\
      std::fprintf(stderr, "%s:%d: CHECK failed: %s\\n", __FILE__, __LINE__, #cond); \\
      std::exit(1); \\
    } \\
  } while (0)
#endif
`;

export const TOKEN_HEADER = "x-gnosis-runner-token";
export const DEFAULT_PORT = 8787;
export const DEFAULT_CONTENT_ROOT = path.resolve(HERE, "..", "content");
const PRODUCTION_ORIGIN = "https://gnonis.vercel.app";
const LESSON_ID = /^[a-z0-9]+(?:[/-][a-z0-9]+)*$/;
const EXERCISE_ID = /^[a-z0-9-]+$/;

export function isAllowedOrigin(origin) {
  if (!origin || origin === "null") return false;
  if (origin === PRODUCTION_ORIGIN) return true;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function corsHeaders(origin, requestPrivateNetwork) {
  if (!isAllowedOrigin(origin)) return null;
  const headers = {
    "access-control-allow-origin": origin,
    vary: "Origin",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-gnosis-runner-token",
    "access-control-max-age": "600",
  };
  if (requestPrivateNetwork) headers["access-control-allow-private-network"] = "true";
  return headers;
}

function clip(value, max) {
  const text = value ?? "";
  return text.length > max ? text.slice(0, max) : text;
}

export function translationUnit(learner, tests) {
  const learnerBody = learner.endsWith("\n") ? learner : `${learner}\n`;
  let source = `#include "check.h"\n#line 1 "solution.cpp"\n${learnerBody}`;
  if (tests != null) {
    const testBody = tests.endsWith("\n") ? tests : `${tests}\n`;
    source += `#line 1 "tests.cpp"\n${testBody}`;
  }
  return source;
}

function crashed(status, signal) {
  if (signal === "SIGSEGV" || signal === "SIGABRT" || signal === "SIGFPE" || signal === "SIGILL" || signal === "SIGBUS") return true;
  if (typeof status !== "number") return false;
  if (status === 139 || status === 134 || status === 136) return true;
  if (status > 128 && status !== 124 && status !== 137 && status !== 152) return true;
  if (status >= 0xc0000000) return true;
  return false;
}

/** Same messages the sandbox harness produces, so the exercise UI can render them. */
export function interpretRun({ graded, status, signal, stdout, stderr, timedOut, runWallSec }) {
  const out = clip(stdout, LIMITS.stdout);
  const errRaw = stderr ?? "";
  if (timedOut) {
    return {
      error: `Timed out after ${runWallSec}s. Infinite loop?`,
      stdout: out,
      stderr: clip(errRaw, LIMITS.stderr),
      tests: [],
      failure: "timeout",
    };
  }
  if (crashed(status, signal)) {
    return {
      error: "The program crashed.",
      stdout: out,
      stderr: clip(errRaw, LIMITS.stderr),
      tests: [],
      failure: "runtime",
    };
  }
  if (graded) {
    const err = clip(errRaw, LIMITS.stderr);
    if (status === 0) return { error: null, stdout: out, stderr: err, tests: [{ name: "checks", passed: true }], failure: null };
    const check = err.split("\n").find((line) => line.includes("CHECK failed:"));
    return {
      error: null,
      stdout: out,
      stderr: err,
      tests: [{ name: "checks", passed: false, message: check?.trim() || `exited ${status}` }],
      failure: null,
    };
  }
  const note = status === 0 || status == null ? "" : `exited ${status}\n`;
  return { error: null, stdout: out, stderr: clip(note + errRaw, LIMITS.stderr), tests: [], failure: null };
}

function resultBody(interpreted) {
  const tests = interpreted.tests ?? [];
  const passed = tests.filter((test) => test.passed).length;
  return {
    error: interpreted.error,
    stdout: interpreted.stdout ?? "",
    stderr: interpreted.stderr ?? "",
    tests,
    passed,
    total: tests.length,
    failure: interpreted.failure ?? null,
    used: null,
    limit: null,
  };
}

/* ---------- course lookup (hidden tests stay out of the browser) ---------- */

class LiteralParser {
  constructor(s) {
    this.s = s;
    this.i = 0;
  }
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
  parseValue() {
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
  keyword(word) {
    if (!this.s.startsWith(word, this.i)) return false;
    const next = this.s[this.i + word.length];
    if (next && /[A-Za-z0-9_]/.test(next)) return false;
    this.i += word.length;
    return true;
  }
  string(quote) {
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
  template() {
    this.i++;
    let out = "";
    while (!this.eof()) {
      const c = this.s[this.i++];
      if (c === "`") return out;
      if (c === "$" && this.peek() === "{") throw new Error("template interpolation is not allowed");
      if (c === "\\") out += this.escape();
      else out += c;
    }
    throw new Error("unterminated template");
  }
  escape() {
    const c = this.s[this.i++] ?? "";
    const map = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "\\": "\\", '"': '"', "'": "'", "`": "`", "/": "/" };
    if (c in map) return map[c];
    if (c === "u") {
      const hex = this.s.slice(this.i, this.i + 4);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new Error("bad unicode escape");
      this.i += 4;
      return String.fromCharCode(parseInt(hex, 16));
    }
    return c;
  }
  number() {
    const m = this.s.slice(this.i).match(/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (!m) throw new Error("bad number");
    this.i += m[0].length;
    return Number(m[0]);
  }
  array() {
    this.i++;
    const out = [];
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
  object() {
    this.i++;
    const out = {};
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

function parseJsxAttributes(source) {
  const p = new LiteralParser(source);
  const out = {};
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
    } else throw new Error(`expected a value for ${name}`);
  }
}

function readTag(source, start, tag) {
  let i = start + 1 + tag.length;
  let brace = 0;
  let quote = null;
  const attrStart = i;
  while (i < source.length) {
    const c = source[i];
    if (quote) {
      if (c === "\\") {
        i += 2;
        continue;
      }
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
    if (brace === 0 && c === "/" && source[i + 1] === ">") return { end: i + 2, attrs: source.slice(attrStart, i) };
    if (brace === 0 && c === ">") throw new Error(`<${tag}> must be self-closing`);
    i++;
  }
  throw new Error(`unclosed <${tag}>`);
}

function frontmatterId(text) {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;
  const match = text.slice(3, end).match(/^id:\s*["']?([a-z0-9]+(?:[/-][a-z0-9]+)*)["']?\s*$/m);
  return match ? match[1] : null;
}

function codeExercises(text) {
  const found = [];
  let fence = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n" || i === 0) {
      const at = text[i] === "\n" ? i + 1 : 0;
      if (text.startsWith("```", at)) fence = !fence;
    }
    if (fence || !text.startsWith("<Code", i)) continue;
    const next = text[i + 5];
    if (next && /[A-Za-z0-9_]/.test(next)) continue;
    try {
      const span = readTag(text, i, "Code");
      found.push(parseJsxAttributes(span.attrs));
      i = span.end - 1;
    } catch {
      /* keep scanning; a prose mention of <Code should not abort the file */
    }
  }
  return found;
}

function walkMdx(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkMdx(full, out);
    else if (entry.isFile() && entry.name.endsWith(".mdx")) out.push(full);
  }
  return out;
}

export function loadCppExercise(contentRoot, lessonId, exerciseId) {
  if (!LESSON_ID.test(lessonId) || !EXERCISE_ID.test(exerciseId)) return null;
  for (const file of walkMdx(contentRoot)) {
    let text;
    try {
      text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    } catch {
      continue;
    }
    if (frontmatterId(text) !== lessonId) continue;
    const exercise = codeExercises(text).find((item) => item.id === exerciseId && item.language === "cpp");
    if (!exercise) return null;
    return {
      tests: typeof exercise.tests === "string" ? exercise.tests : "",
      visibleTests: typeof exercise.visibleTests === "string" ? exercise.visibleTests : "",
    };
  }
  return null;
}

function asString(value, max) {
  if (typeof value !== "string") return { ok: false, message: "That request didn't look right." };
  if (value.length > max) return { ok: false, message: "That program is too long to compile." };
  return { ok: true, value };
}

/**
 * Accepts the sandbox route body (`action`, `runKind`, `code`, `lessonId`, `exerciseId`, `stdin`)
 * plus optional `tests` (the check.h file already on screen for Run samples) and `mode`
 * (`samples` | `stdin` | `submit`) as another way to spell the same three runs.
 */
/**
 * @returns {{ ok: true, plan: { source: string, graded: boolean, stdin: string }, lessonId: string, exerciseId: string, action: string } | { ok: false, status: number, message: string }}
 */
export function resolveJob(body, contentRoot) {
  if (!body || typeof body !== "object") return { ok: false, status: 400, message: "That request didn't look right." };
  const mode = body.mode === "samples" || body.mode === "stdin" || body.mode === "submit" ? body.mode : null;
  const action = mode === "submit" ? "submit" : mode ? "run" : body.action;
  const runKind = mode === "samples" || mode === "stdin" ? mode : body.runKind;
  if (action !== "run" && action !== "submit") return { ok: false, status: 400, message: "That request didn't look right." };
  if (action === "run" && runKind !== "samples" && runKind !== "stdin") {
    return { ok: false, status: 400, message: "That request didn't look right." };
  }
  const code = asString(body.code, LIMITS.code);
  if (!code.ok) return { ok: false, status: 400, message: code.message };
  const lessonId = typeof body.lessonId === "string" ? body.lessonId : "";
  const exerciseId = typeof body.exerciseId === "string" ? body.exerciseId : "";
  if (!LESSON_ID.test(lessonId) || !EXERCISE_ID.test(exerciseId)) {
    return { ok: false, status: 400, message: "That request didn't look right." };
  }

  if (action === "run" && runKind === "stdin") {
    const stdin = typeof body.stdin === "string" ? body.stdin : "";
    if (stdin.length > LIMITS.stdin) return { ok: false, status: 400, message: "That input is too long." };
    return { ok: true, plan: { source: translationUnit(code.value, null), graded: false, stdin }, lessonId, exerciseId, action };
  }

  let tests = typeof body.tests === "string" ? body.tests : "";
  if (!tests.trim()) {
    const exercise = loadCppExercise(contentRoot, lessonId, exerciseId);
    if (!exercise) return { ok: false, status: 404, message: "That C++ exercise isn't in the local course files. Start the runner from the Gnosis repo." };
    tests = action === "submit" ? exercise.tests : exercise.visibleTests;
  }
  if (!tests.trim()) {
    return {
      ok: false,
      status: 400,
      message: action === "submit" ? "This exercise has no tests to run." : "This exercise has no sample tests. Use custom input.",
    };
  }
  if (tests.length > LIMITS.tests) return { ok: false, status: 400, message: "Those tests are too long." };
  return { ok: true, plan: { source: translationUnit(code.value, tests), graded: true, stdin: "" }, lessonId, exerciseId, action };
}

/* ---------- compiler ---------- */

function killTree(child) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    return;
  }
  try {
    child.kill("SIGKILL");
  } catch {
    /* already gone */
  }
}

function spawnCaptured(cmd, args, { cwd, input, timeoutMs, maxBytes = 1_000_000 } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { cwd, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    } catch (error) {
      resolve({ status: null, signal: null, stdout: "", stderr: "", timedOut: false, error });
      return;
    }
    const out = [];
    const err = [];
    let outLen = 0;
    let errLen = 0;
    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);
    const finish = (status, signal, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        status: status ?? null,
        signal: signal ?? null,
        stdout: Buffer.concat(out).toString("utf8"),
        stderr: Buffer.concat(err).toString("utf8"),
        timedOut,
        error: error ?? null,
      });
    };
    child.stdout.on("data", (chunk) => {
      outLen += chunk.length;
      if (outLen <= maxBytes) out.push(chunk);
      else if (outLen > maxBytes * 4) killTree(child);
    });
    child.stderr.on("data", (chunk) => {
      errLen += chunk.length;
      if (errLen <= maxBytes) err.push(chunk);
      else if (errLen > maxBytes * 4) killTree(child);
    });
    child.on("error", (error) => finish(null, null, error));
    child.on("close", (status, signal) => finish(status, signal, null));
    const onStdinError = () => {};
    child.stdin.on("error", onStdinError);
    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

async function probe(cmd, args) {
  const ran = await spawnCaptured(cmd, args, { timeoutMs: 8_000, maxBytes: 16_000 });
  if (ran.error || ran.status !== 0) return null;
  return ran.stdout.trim();
}

/** g++ on PATH (MSYS2/MinGW, or this process running inside WSL), then clang++, then `wsl g++` from Windows. */
export async function findCompiler() {
  const native = process.platform === "win32" ? ["g++.exe", "g++", "clang++.exe", "clang++"] : ["g++", "clang++"];
  for (const bin of native) {
    const version = await probe(bin, ["--version"]);
    if (!version) continue;
    const triple = (await probe(bin, ["-dumpmachine"])) ?? "";
    return { kind: "native", bin, triple: triple.split(/\s+/)[0] ?? "", version: version.split("\n")[0] };
  }
  if (process.platform === "win32") {
    for (const bin of ["g++", "clang++"]) {
      const version = await probe("wsl.exe", ["-e", bin, "--version"]);
      if (!version) continue;
      const triple = (await probe("wsl.exe", ["-e", bin, "-dumpmachine"])) ?? "";
      return { kind: "wsl", bin, triple: triple.split(/\s+/)[0] ?? "", version: version.split("\n")[0] };
    }
  }
  return null;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

async function compileAndRun(compiler, plan, timeouts) {
  if (!compiler) {
    return {
      error: "g++ or clang++ was not found on PATH. Install MSYS2 mingw-w64 g++ or WSL g++, then restart the runner.",
      stdout: "",
      stderr: "",
      tests: [],
      failure: "unavailable",
    };
  }
  if (!compiler.triple.startsWith("x86_64")) {
    const triple = compiler.triple || "unknown";
    return {
      error: `This compiler is ${triple}. C++ exercises need x86-64 g++ so SSE2 (<emmintrin.h>) builds.`,
      stdout: "",
      stderr: "",
      tests: [],
      failure: "unavailable",
    };
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosis-cpp-"));
  const runWallSec = Math.max(1, Math.round(timeouts.runMs / 1000));
  try {
    fs.writeFileSync(path.join(dir, "check.h"), CHECK_HEADER);
    fs.writeFileSync(path.join(dir, "main.cpp"), plan.source);
    const outName = compiler.kind === "wsl" ? "prog" : process.platform === "win32" ? "prog.exe" : "prog";
    const args = ["-std=c++20", "-O2", "-fdiagnostics-color=never", "-o", outName, "main.cpp"];
    const compiled =
      compiler.kind === "native"
        ? await spawnCaptured(compiler.bin, args, { cwd: dir, timeoutMs: timeouts.compileMs })
        : await spawnCaptured("wsl.exe", ["-e", "bash", "-lc", `set -eu\ncd "$(wslpath -a ${shellQuote(dir)})"\n${compiler.bin} ${args.map(shellQuote).join(" ")}`], {
            timeoutMs: timeouts.compileMs,
          });
    if (compiled.error && compiled.error.code === "ENOENT") {
      return {
        error: "The compiler disappeared from PATH. Restart the runner after installing g++.",
        stdout: "",
        stderr: "",
        tests: [],
        failure: "unavailable",
      };
    }
    if (compiled.timedOut) {
      return { error: "Compilation timed out.", stdout: "", stderr: clip(compiled.stderr, LIMITS.stderr), tests: [], failure: "timeout" };
    }
    if (compiled.status !== 0) {
      const text = clip((compiled.stderr || compiled.stdout || "Compilation failed.").trim() || "Compilation failed.", LIMITS.stderr);
      return { error: `Compile error:\n${text}`, stdout: "", stderr: text, tests: [], failure: "compile" };
    }
    const ran =
      compiler.kind === "native"
        ? await spawnCaptured(path.join(dir, outName), [], { cwd: dir, input: plan.stdin, timeoutMs: timeouts.runMs })
        : await spawnCaptured(
            "wsl.exe",
            [
              "-e",
              "bash",
              "-lc",
              `src=$(wslpath -a ${shellQuote(dir)})
work=$(mktemp -d)
cp "$src/${outName}" "$work/prog"
chmod +x "$work/prog"
"$work/prog"
status=$?
rm -rf "$work"
exit $status`,
            ],
            { input: plan.stdin, timeoutMs: timeouts.runMs },
          );
    return interpretRun({ graded: plan.graded, ...ran, runWallSec });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function tokenOk(header, token) {
  if (typeof header !== "string") return false;
  const got = Buffer.from(header);
  const expect = Buffer.from(token);
  if (got.length !== expect.length || got.length === 0) return false;
  return crypto.timingSafeEqual(got, expect);
}

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

export function createHandler({ token, contentRoot, compiler, timeouts }) {
  return async function handle(req, res) {
    const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
    const privateNetwork = req.headers["access-control-request-private-network"] === "true";
    const cors = origin ? corsHeaders(origin, privateNetwork || req.method === "OPTIONS") : {};
    if (origin && !cors) {
      send(res, 403, { "content-type": "text/plain; charset=utf-8" }, "This runner only answers https://gnonis.vercel.app and localhost.");
      return;
    }
    const headers = { ...cors };
    if (req.method === "OPTIONS") {
      send(res, 204, headers, "");
      return;
    }
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/")) {
      if (!tokenOk(req.headers[TOKEN_HEADER], token)) {
        send(res, 401, { ...headers, "content-type": "text/plain; charset=utf-8" }, "That pairing token does not match.");
        return;
      }
      const payload = {
        ok: true,
        compiler: compiler ? compiler.bin : null,
        triple: compiler?.triple || null,
        version: compiler?.version || null,
        archOk: compiler ? compiler.triple.startsWith("x86_64") : false,
      };
      send(res, 200, { ...headers, "content-type": "application/json; charset=utf-8" }, JSON.stringify(payload));
      return;
    }
    if (req.method === "POST" && (url.pathname === "/run" || url.pathname === "/")) {
      if (!tokenOk(req.headers[TOKEN_HEADER], token)) {
        send(res, 401, { ...headers, "content-type": "text/plain; charset=utf-8" }, "That pairing token does not match.");
        return;
      }
      let raw = "";
      try {
        raw = await readBody(req, 120_000);
      } catch (error) {
        const status = error.status === 413 ? 413 : 400;
        send(res, status, { ...headers, "content-type": "text/plain; charset=utf-8" }, status === 413 ? "That request is too large." : "That request didn't look right.");
        return;
      }
      let json;
      try {
        json = JSON.parse(raw);
      } catch {
        send(res, 400, { ...headers, "content-type": "text/plain; charset=utf-8" }, "That request didn't look right.");
        return;
      }
      const job = resolveJob(json, contentRoot);
      if (!job.ok) {
        send(res, job.status, { ...headers, "content-type": "text/plain; charset=utf-8" }, job.message);
        return;
      }
      const interpreted = await compileAndRun(compiler, job.plan, timeouts);
      const body = resultBody(interpreted);
      console.log(`${new Date().toISOString()} ${job.action} ${job.lessonId}#${job.exerciseId} ${body.failure ?? (body.tests.some((test) => test.passed === false) ? "fail" : "ok")}`);
      send(res, 200, { ...headers, "content-type": "application/json; charset=utf-8" }, JSON.stringify(body));
      return;
    }
    send(res, 404, { ...headers, "content-type": "text/plain; charset=utf-8" }, "Not found.");
  };
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        const error = new Error("too big");
        error.status = 413;
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * @param {{
 *   port?: number,
 *   token: string,
 *   contentRoot?: string,
 *   compiler?: *,
 *   timeouts?: { compileMs?: number, runMs?: number },
 * }} options
 */
export async function startRunner({ port = 0, token, contentRoot = DEFAULT_CONTENT_ROOT, compiler, timeouts } = {}) {
  const resolvedCompiler = compiler === undefined ? await findCompiler() : compiler;
  const handler = createHandler({
    token,
    contentRoot,
    compiler: resolvedCompiler,
    timeouts: { compileMs: timeouts?.compileMs ?? LIMITS.compileMs, runMs: timeouts?.runMs ?? LIMITS.runMs },
  });
  const server = http.createServer((req, res) => {
    void handler(req, res).catch((error) => {
      console.error("runner error", error instanceof Error ? error.message : error);
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("The runner hit an error.");
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address();
  return {
    server,
    port: typeof address === "object" && address ? address.port : port,
    address: typeof address === "object" && address ? address.address : "127.0.0.1",
    compiler: resolvedCompiler,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

async function main() {
  const portArg = argValue("--port") ?? process.env.GNOSIS_RUNNER_PORT ?? String(DEFAULT_PORT);
  const port = Number(portArg);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("Port must be an integer from 1 to 65535.");
    process.exit(1);
  }
  const token = argValue("--token") ?? process.env.GNOSIS_RUNNER_TOKEN ?? crypto.randomBytes(24).toString("hex");
  const contentRoot = process.env.GNOSIS_CONTENT_ROOT || DEFAULT_CONTENT_ROOT;
  const compiler = await findCompiler();
  const started = await startRunner({ port, token, contentRoot, compiler });
  console.log("Gnosis local C++ runner");
  console.log(`Listening on http://127.0.0.1:${started.port}`);
  console.log(`Pairing token: ${token}`);
  if (!compiler) {
    console.log("Compiler: not found. Install MSYS2 mingw-w64 g++ (on PATH) or WSL g++, then restart.");
  } else {
    console.log(`Compiler: ${compiler.bin} (${compiler.triple || "unknown target"})${compiler.kind === "wsl" ? " via WSL" : ""}`);
    if (!compiler.triple.startsWith("x86_64")) console.log("This target is not x86-64. C++ exercises need x86-64 g++ so SSE2 builds.");
  }
  console.log("Paste the token into a C++ exercise → Run on my PC. This window must stay open.");
  console.log("Ctrl+C stops the runner.");
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
