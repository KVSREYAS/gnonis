import { DEFAULT_CHAT_MODEL, isAllowedModel } from "./models";

/** Default model for this deployment. `OPENROUTER_MODEL` wins over the built-in Haiku default. */
export function configuredDefaultModel(): string {
  const env = process.env.OPENROUTER_MODEL?.trim();
  return env || DEFAULT_CHAT_MODEL;
}

/**
 * Model id that is safe to send to the browser. A custom `OPENROUTER_MODEL`
 * stays on the server; the picker then shows "Server default" and omits `model`.
 */
export function clientDefaultModel(): string {
  const model = configuredDefaultModel();
  return isAllowedModel(model) ? model : "";
}

/**
 * A client-supplied id must be on the allowlist. An empty choice uses the server default,
 * which may be `OPENROUTER_MODEL` even when that id is not in the picker.
 * Returns null when the client asked for something else.
 */
export function resolveChatModel(requested: unknown): string | null {
  if (requested == null || requested === "") return configuredDefaultModel();
  if (typeof requested === "string" && isAllowedModel(requested)) return requested;
  return null;
}
