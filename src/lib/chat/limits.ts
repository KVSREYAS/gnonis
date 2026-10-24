export const DEFAULT_DAILY_LIMIT = 40;
export const DEFAULT_WEB_LIMIT = 10;

/** Positive integers only. Anything else falls back so a bad env var can't open the cap. */
export function readLimit(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 10_000) return fallback;
  return n;
}

export function dailyLimit(): number {
  return readLimit(process.env.CHAT_DAILY_LIMIT, DEFAULT_DAILY_LIMIT);
}

export function webLimit(): number {
  return readLimit(process.env.CHAT_DAILY_WEB_LIMIT, DEFAULT_WEB_LIMIT);
}

export type UsageRow = {
  messageCount: number;
  webCount: number;
  allowed: boolean;
  reason: string;
};

/** Decide from the RPC row. Counts are checked again so a forged `allowed` flag still fails closed. */
export function usageGate(
  row: UsageRow,
  web: boolean,
  limits: { daily: number; web: number },
): "ok" | "daily" | "web" {
  if (row.messageCount > limits.daily || row.reason === "daily") return "daily";
  if (web && (row.webCount > limits.web || row.reason === "web")) return "web";
  if (!row.allowed) return web && row.reason === "web" ? "web" : "daily";
  return "ok";
}

export function limitMessage(reason: "daily" | "web", limits: { daily: number; web: number }): string {
  if (reason === "web") {
    return `You've used today's ${limits.web} web lookups. Turn off the globe to keep chatting, or come back after midnight UTC.`;
  }
  return `You've used today's ${limits.daily} dive-deeper messages. The counter resets at midnight UTC. You can still open the question in ChatGPT.`;
}
