import type { UIMessage } from "ai";

export const CHAT_STORAGE_PREFIX = "gnosis:chat:v1:";
export const MODEL_STORAGE_KEY = "gnosis:chat:model";

const MAX_MESSAGES = 40;
const MAX_CHARS = 120_000;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function partFrom(value: unknown): UIMessage["parts"][number] | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  if (value.type === "text" && typeof value.text === "string" && value.text.trim()) {
    return { type: "text", text: value.text.slice(0, 8000) };
  }
  if (value.type === "source-url" && typeof value.url === "string" && typeof value.sourceId === "string") {
    return {
      type: "source-url",
      sourceId: value.sourceId.slice(0, 300),
      url: value.url.slice(0, 2000),
      title: typeof value.title === "string" ? value.title.slice(0, 300) : undefined,
    };
  }
  return null;
}

export function chatStorageKey(lessonKey: string): string {
  return `${CHAT_STORAGE_PREFIX}${lessonKey}`;
}

export function sanitizeMessages(value: unknown): UIMessage[] {
  if (!Array.isArray(value)) return [];
  const messages: UIMessage[] = [];
  for (const item of value) {
    if (!isRecord(item) || (item.role !== "user" && item.role !== "assistant") || typeof item.id !== "string") continue;
    if (!Array.isArray(item.parts)) continue;
    const parts = item.parts.map(partFrom).filter((part) => part !== null);
    if (!parts.length) continue;
    messages.push({ id: item.id.slice(0, 80), role: item.role, parts });
  }
  return messages.slice(-MAX_MESSAGES);
}

export function loadChat(storage: Store, lessonKey: string): UIMessage[] {
  try {
    const raw = storage.getItem(chatStorageKey(lessonKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    const messages = isRecord(parsed) ? parsed.messages : parsed;
    return sanitizeMessages(messages);
  } catch {
    return [];
  }
}

export function saveChat(storage: Store, lessonKey: string, messages: UIMessage[]): void {
  const key = chatStorageKey(lessonKey);
  let slim = sanitizeMessages(messages);
  try {
    while (slim.length && JSON.stringify({ messages: slim }).length > MAX_CHARS) slim = slim.slice(1);
    if (!slim.length) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify({ messages: slim }));
  } catch {
    /* private mode or a full disk */
  }
}
