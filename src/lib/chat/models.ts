/**
 * Models the dive-deeper picker is allowed to request.
 * Prices are USD per 1M tokens (input / output), checked against
 * https://openrouter.ai/api/v1/models on 2026-10-24.
 * Haiku's list price is $0.0000001 / $0.0000005 per token.
 */
export const DEFAULT_CHAT_MODEL = "anthropic/claude-haiku-5.5";

export const CHAT_MODELS = [
  { id: "anthropic/claude-haiku-5.5", label: "Claude Haiku", price: "$0.10 / $0.50" },
  { id: "deepseek/deepseek-v4-flash", label: "DeepSeek Flash", price: "$0.091 / $0.182" },
  { id: "z-ai/glm-5.3-flash", label: "GLM Flash", price: "$0.15 / $0.50" },
  { id: "qwen/qwen3.7-flash", label: "Qwen Flash", price: "$0.03 / $0.13" },
] as const;

export type ChatModelId = (typeof CHAT_MODELS)[number]["id"];

const ALLOWED = new Set<string>(CHAT_MODELS.map((model) => model.id));

export function isAllowedModel(id: string): id is ChatModelId {
  return ALLOWED.has(id);
}
