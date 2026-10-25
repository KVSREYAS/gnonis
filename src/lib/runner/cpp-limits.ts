import { readLimit } from "@/lib/chat/limits";

/** Runs per signed-in user per UTC day. Each Run and each Submit counts as one. */
export const DEFAULT_CPP_DAILY_LIMIT = 40;

export function cppDailyLimit(): number {
  return readLimit(process.env.CPP_DAILY_LIMIT, DEFAULT_CPP_DAILY_LIMIT);
}

export type CppUsageRow = {
  runCount: number;
  allowed: boolean;
  reason: string;
};

/** Fail closed: a forged `allowed` flag still loses if the count is over the cap. */
export function cppUsageGate(row: CppUsageRow, limit: number): "ok" | "daily" {
  if (row.runCount > limit || row.reason === "daily" || !row.allowed) return "daily";
  return "ok";
}

export function cppLimitMessage(limit: number): string {
  return `You've used today's ${limit} C++ runs. The counter resets at midnight UTC.`;
}
