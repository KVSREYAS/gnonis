import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { dailyLimit, limitMessage, usageGate, webLimit, type UsageRow } from "@/lib/chat/limits";
import { resolveChatModel } from "@/lib/chat/model-server";
import { tutorInstructions, type TutorContext } from "@/lib/chat/prompt";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const HISTORY_LIMIT = 12;
const MAX_OUTPUT_TOKENS = 800;

const contextSchema = z.object({
  courseTitle: z.string().max(200),
  lessonTitle: z.string().max(200),
  district: z.string().max(200),
  stepTitle: z.string().max(200),
  stepKind: z.enum(["card", "exercise"]),
  stepText: z.string().max(8000),
  exerciseUnanswered: z.boolean(),
});

const bodySchema = z.object({
  web: z.boolean().optional(),
  model: z.string().max(120).optional(),
  context: contextSchema,
  messages: z
    .array(
      z.object({
        id: z.string().max(80),
        role: z.enum(["user", "assistant"]),
        parts: z.array(z.record(z.string(), z.unknown())).max(40),
      }),
    )
    .max(40),
});

function plain(message: string, status: number) {
  return new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

function textFromParts(parts: Record<string, unknown>[]): string {
  return parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => (part.text as string).slice(0, 4000))
    .join("\n")
    .trim();
}

function historyFrom(messages: z.infer<typeof bodySchema>["messages"]): UIMessage[] {
  const recent = messages.slice(-HISTORY_LIMIT);
  const ui: UIMessage[] = [];
  for (const message of recent) {
    const text = textFromParts(message.parts);
    if (!text) continue;
    ui.push({ id: message.id, role: message.role, parts: [{ type: "text", text }] });
  }
  return ui;
}

function usageRow(data: unknown): UsageRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  if (typeof record.message_count !== "number" || typeof record.web_count !== "number" || typeof record.allowed !== "boolean") {
    return null;
  }
  return {
    messageCount: record.message_count,
    webCount: record.web_count,
    allowed: record.allowed,
    reason: typeof record.reason === "string" ? record.reason : "",
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return plain("Dive deeper isn't turned on for this server.", 503);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return plain("That message didn't look right.", 400);
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return plain("That message didn't look right.", 400);

  const web = parsed.data.web === true;
  const model = resolveChatModel(parsed.data.model?.trim() || "");
  if (!model) return plain("Pick one of the models in the list.", 400);

  const messages = historyFrom(parsed.data.messages);
  const last = messages.at(-1);
  if (!last || last.role !== "user") return plain("Type a question first.", 400);

  const supabase = await createClient();
  if (!supabase) return plain("Sign in to use dive deeper.", 401);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return plain("Sign in to use dive deeper.", 401);

  const limits = { daily: dailyLimit(), web: webLimit() };
  const { data: usageData, error: usageError } = await supabase.rpc("increment_chat_usage", {
    p_web: web,
    p_limit: limits.daily,
    p_web_limit: limits.web,
  });
  if (usageError) {
    console.error("chat usage rpc failed", usageError);
    return plain("Dive deeper isn't ready yet. The chat usage table still needs to be added in Supabase.", 503);
  }
  const row = usageRow(usageData);
  if (!row) return plain("Dive deeper isn't ready yet. The chat usage table still needs to be added in Supabase.", 503);

  const gate = usageGate(row, web, limits);
  if (gate !== "ok") return plain(limitMessage(gate, limits), 429);

  const context: TutorContext = parsed.data.context;
  const openrouter = createOpenRouter({
    apiKey,
    appName: "Gnosis",
    appUrl: "https://gnonis.vercel.app",
  });

  try {
    const result = streamText({
      model: openrouter.chat(model, {
        user: userData.user.id,
        plugins: web ? [{ id: "web", max_results: 3 }] : undefined,
      }),
      instructions: tutorInstructions(context, web),
      messages: await convertToModelMessages(messages),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        sendSources: true,
        sendReasoning: false,
        onError(error) {
          console.error("openrouter stream failed", error);
          return "The tutor hit a snag. Try again in a moment.";
        },
      }),
    });
  } catch (error) {
    console.error("openrouter request failed", error);
    return plain("The tutor hit a snag. Try again in a moment.", 502);
  }
}
