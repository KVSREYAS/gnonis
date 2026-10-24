import { describe, expect, it } from "vitest";
import { byteHint, CalcError, evaluateExpression, formatCalcValue } from "@/lib/calc/parse";

describe("calculator", () => {
  it("evaluates the inference-style expression", () => {
    expect(evaluateExpression("2*7e9*2/1e9")).toBe(28);
    expect(formatCalcValue(28)).toBe("28");
  });

  it("supports powers, parentheses, unary minus, and functions", () => {
    expect(evaluateExpression("2^10")).toBe(1024);
    expect(evaluateExpression("2**3**2")).toBe(512);
    expect(evaluateExpression("(2+3)*4")).toBe(20);
    expect(evaluateExpression("-2^2")).toBe(-4);
    expect(evaluateExpression("2*-3")).toBe(-6);
    expect(evaluateExpression("sqrt(9)")).toBe(3);
    expect(evaluateExpression("log(1000)")).toBeCloseTo(3);
    expect(evaluateExpression("ln(1)")).toBe(0);
    expect(evaluateExpression("log2(8)")).toBeCloseTo(3);
    expect(evaluateExpression("abs(-4)")).toBe(4);
  });

  it("treats KB/MB/GB/TB as decimal and KiB/GiB as binary", () => {
    expect(evaluateExpression("4 KB")).toBe(4000);
    expect(evaluateExpression("2GB")).toBe(2e9);
    expect(evaluateExpression("2 GB / 1 MB")).toBe(2000);
    expect(evaluateExpression("1 KiB")).toBe(1024);
    expect(evaluateExpression("(1+1) MB")).toBe(2e6);
    expect(byteHint(2.8e10)).toBe("28 GB");
  });

  it("rejects eval tricks, division by zero, and unknown names", () => {
    expect(() => evaluateExpression("constructor")).toThrow(CalcError);
    expect(() => evaluateExpression("process.exit()")).toThrow(CalcError);
    expect(() => evaluateExpression("1/0")).toThrow(/zero/);
    expect(() => evaluateExpression("sqrt(-1)")).toThrow(CalcError);
    expect(() => evaluateExpression("log(0)")).toThrow(CalcError);
  });
});
