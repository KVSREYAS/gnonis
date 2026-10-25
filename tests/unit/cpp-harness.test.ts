import { describe, expect, it } from "vitest";
import { executeCppPlan, findGpp } from "@/lib/runner/cpp-local";
import { cppJobFiles, interpretCppOutput, planCpp, translationUnit } from "@/lib/runner/cpp-harness";

const gpp = findGpp();

const SOLUTION = "long long add(long long a, long long b) {\n    return a + b;\n}\n";
const STARTER = "long long add(long long a, long long b) {\n    return 0;\n}\n";
const VISIBLE = `#include "check.h"

int main() {
    CHECK(add(2, 3) == 5);
    return 0;
}
`;
const HIDDEN = `#include "check.h"

int main() {
    CHECK(add(-4, 10) == 6);
    CHECK(add(0, 0) == 0);
    CHECK(add(2000000000LL, 2000000000LL) == 4000000000LL);
    return 0;
}
`;

describe("C++ plan", () => {
  it("builds one translation unit and keeps the source out of the shell script", () => {
    const token = "UNIQUE_LEARNER_TOKEN_9f3a";
    const planned = planCpp({
      code: `int marker() { return 0; } /* ${token} */\n`,
      tests: `int main() { CHECK(marker() == 0); return 0; }\n`,
      mode: "tests",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.plan.graded).toBe(true);
    expect(planned.plan.source).toContain('#include "check.h"');
    expect(planned.plan.source).toContain('#line 1 "solution.cpp"');
    expect(planned.plan.source).toContain('#line 1 "tests.cpp"');
    expect(planned.plan.source).toContain(token);
    const files = cppJobFiles(planned.plan);
    const script = files.find((file) => file.path === "run.sh")?.content ?? "";
    expect(script).not.toContain(token);
    expect(script).toContain("g++ -std=c++20 -O2");
    expect(script).toContain("x86_64");
    expect(script).toContain("ulimit -t 2 -v 524288");
    expect(files.find((file) => file.path === "check.h")?.content).toContain("#define CHECK(cond)");
    expect(files.find((file) => file.path === "main.cpp")?.content).toBe(planned.plan.source);
  });

  it("reports a non-x86-64 compiler before compiling", () => {
    const planned = planCpp({ code: "int main(){return 0;}\n", mode: "stdin", stdin: "" });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const result = interpretCppOutput(planned.plan, "__IA_ARCH__ aarch64-linux-gnu\n");
    expect(result.failure).toBe("unavailable");
    expect(result.error).toMatch(/x86-64/);
    expect(result.error).toMatch(/emmintrin\.h/);
  });

  it("preserves test line numbers", () => {
    const source = translationUnit("int add(int a, int b) { return a + b; }\n", "int main() {\n    CHECK(add(1, 1) == 3);\n    return 0;\n}\n");
    expect(source).toContain('#line 1 "tests.cpp"\nint main() {\n    CHECK(add(1, 1) == 3);');
  });
});

describe("C++ local g++", () => {
  it.skipIf(!gpp)("passes the sample solution, fails the starter, and prints file:line", () => {
    const good = planCpp({ code: SOLUTION, tests: HIDDEN, mode: "tests" });
    const visible = planCpp({ code: SOLUTION, tests: VISIBLE, mode: "tests" });
    const starter = planCpp({ code: STARTER, tests: HIDDEN, mode: "tests" });
    expect(good.ok && visible.ok && starter.ok).toBe(true);
    if (!good.ok || !visible.ok || !starter.ok) return;
    expect(executeCppPlan(good.plan).tests).toEqual([{ name: "checks", passed: true }]);
    expect(executeCppPlan(visible.plan).tests).toEqual([{ name: "checks", passed: true }]);
    const failed = executeCppPlan(starter.plan);
    expect(failed.error).toBeNull();
    expect(failed.tests[0]?.passed).toBe(false);
    expect(failed.tests[0]?.message).toMatch(/tests\.cpp:\d+: CHECK failed: add\(-4, 10\) == 6/);
    expect(failed.stderr).toContain("tests.cpp:");
  });

  it.skipIf(!gpp)("compiles SSE2 intrinsics on x86-64", () => {
    const planned = planCpp({
      code: `#include <emmintrin.h>
int twice(int x) {
    __m128i v = _mm_set1_epi32(x);
    __m128i w = _mm_add_epi32(v, v);
    return _mm_cvtsi128_si32(w);
}
`,
      tests: `#include "check.h"
int main() {
    CHECK(twice(21) == 42);
    return 0;
}
`,
      mode: "tests",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const ran = executeCppPlan(planned.plan);
    expect(ran.error).toBeNull();
    expect(ran.tests).toEqual([{ name: "checks", passed: true }]);
  });

  it.skipIf(!gpp)("runs the editor alone on custom stdin", () => {
    const planned = planCpp({
      code: `#include <iostream>\n#include <string>\nint main(){ std::string s; std::getline(std::cin, s); std::cout << s << "\\n"; }\n`,
      mode: "stdin",
      stdin: "hello\n",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const ran = executeCppPlan(planned.plan);
    expect(ran.error).toBeNull();
    expect(ran.tests).toEqual([]);
    expect(ran.stdout).toContain("hello");
  });

  it.skipIf(!gpp)("points a compile error at solution.cpp", () => {
    const planned = planCpp({
      code: "int add(int a, int b) { return\n",
      tests: "int main() { return 0; }\n",
      mode: "tests",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const ran = executeCppPlan(planned.plan);
    expect(ran.failure).toBe("compile");
    expect(ran.error).toMatch(/Compile error:/);
    expect(ran.stderr).toContain("solution.cpp");
  });

  it.skipIf(!gpp)("stops a tight loop", () => {
    const planned = planCpp({
      code: "int main(){ volatile unsigned long x = 0; while (true) x++; }\n",
      mode: "stdin",
      stdin: "",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const ran = executeCppPlan(planned.plan);
    expect(ran.failure).toBe("timeout");
    expect(ran.error).toMatch(/Timed out/);
  }, 15_000);
});
