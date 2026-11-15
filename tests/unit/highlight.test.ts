import { describe, expect, it } from "vitest";
import { highlightCode } from "@/lib/highlight";
import {
  isOutputLang,
  languageLabel,
  resolveLanguage,
  shouldNumberLines,
  splitMarkdownFences,
} from "@/lib/highlight-parse";

describe("resolveLanguage", () => {
  it("aliases common tags and uses the course default when a fence has no tag", () => {
    expect(resolveLanguage("c++")).toBe("cpp");
    expect(resolveLanguage("py")).toBe("python");
    expect(resolveLanguage("sh")).toBe("bash");
    expect(resolveLanguage("txt")).toBe("text");
    expect(resolveLanguage("")).toBe("text");
    expect(resolveLanguage("", "cpp")).toBe("cpp");
    expect(resolveLanguage("cpp", "python")).toBe("cpp");
  });
});

describe("splitMarkdownFences", () => {
  it("splits adjacent cpp and output fences and leaves prose alone", () => {
    const source = [
      "Look at this:",
      "```cpp",
      "int x = 1;",
      "```",
      "```text",
      "1",
      "```",
      "And done.",
    ].join("\n");
    const segments = splitMarkdownFences(source);
    expect(segments).toEqual([
      { type: "prose", markdown: "Look at this:" },
      { type: "code", lang: "cpp", meta: "", code: "int x = 1;", lineCount: 1 },
      { type: "code", lang: "text", meta: "", code: "1", lineCount: 1 },
      { type: "prose", markdown: "And done." },
    ]);
  });

  it("treats an unclosed fence as code through the end of the source", () => {
    const segments = splitMarkdownFences("```cpp\nint x;\n// still open");
    expect(segments).toEqual([{ type: "code", lang: "cpp", meta: "", code: "int x;\n// still open", lineCount: 2 }]);
  });
});

describe("labels and line numbers", () => {
  it("labels languages and numbers long source blocks but not output", () => {
    expect(languageLabel("cpp")).toBe("C++");
    expect(languageLabel("text")).toBe("Output");
    expect(isOutputLang("text")).toBe(true);
    expect(shouldNumberLines("cpp", 8)).toBe(true);
    expect(shouldNumberLines("cpp", 7)).toBe(false);
    expect(shouldNumberLines("text", 20)).toBe(false);
  });
});

describe("highlightCode", () => {
  it("emits dual-theme Shiki HTML for C++ and leaves output untokenised", async () => {
    const cpp = await highlightCode("int main() { return 0; }", "cpp");
    expect(cpp).toContain('class="shiki');
    expect(cpp).toContain("--shiki-light");
    expect(cpp).toContain("--shiki-dark");
    expect(cpp).toContain("int");
    expect(cpp).toContain("main");

    const output = await highlightCode("enemies left: 1", "text");
    expect(output).toContain('class="shiki');
    expect(output).toContain("enemies left: 1");
    expect(output).not.toContain("F97583");
  });
});
