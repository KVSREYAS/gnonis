import { watch, type FSWatcher } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

/** Dev-only SSE feed. Production returns 404 so the route is not a public watcher. */
export function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();
  let watcher: FSWatcher | undefined;
  let beat: ReturnType<typeof setInterval> | undefined;
  let pending: ReturnType<typeof setTimeout> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          /* client went away */
        }
      };
      send("ready");
      beat = setInterval(() => send("ping"), 15_000);
      try {
        watcher = watch(path.join(process.cwd(), "content"), { recursive: true }, () => {
          clearTimeout(pending);
          pending = setTimeout(() => send("reload"), 120);
        });
      } catch {
        send("error");
      }
    },
    cancel() {
      clearInterval(beat);
      clearTimeout(pending);
      watcher?.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
