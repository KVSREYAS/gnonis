import type { Exercise } from "@/lib/content/schema";

/**
 * What the browser is allowed to see. Reference solutions never leave the server.
 * C++ hidden tests stay on the server too: Submit looks them up by exercise id.
 * Python hidden tests still ship, because Pyodide grades them in the browser.
 */
export function forClient(ex: Exercise): Exercise {
  if (ex.type === "code" && ex.language === "cpp") return { ...ex, solution: "", tests: "" };
  if (ex.type === "code") return { ...ex, solution: "" };
  if (ex.type === "debug") return { ...ex, solution: undefined };
  return ex;
}
