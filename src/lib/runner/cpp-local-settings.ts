/**
 * "Run on my PC" settings. The runner listens on 127.0.0.1 and expects this token header.
 * The header name matches `TOKEN_HEADER` in local-runner/gnosis-runner.mjs.
 */

export const LOCAL_RUNNER_KEY = "gnosis:cpp-local-runner:v1";
export const LOCAL_RUNNER_PORT = 8787;
export const LOCAL_RUNNER_HEADER = "x-gnosis-runner-token";
export const LOCAL_RUNNER_EVENT = "gnosis-local-runner-change";

export type LocalRunnerSettings = {
  enabled: boolean;
  port: number;
  token: string;
};

export const DEFAULT_LOCAL_RUNNER: LocalRunnerSettings = {
  enabled: false,
  port: LOCAL_RUNNER_PORT,
  token: "",
};

export type LocalRunnerHealth =
  | { state: "connected"; detail: string }
  | { state: "down"; detail: string };

function portOf(value: unknown): number {
  const port = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return LOCAL_RUNNER_PORT;
  return port;
}

export function parseLocalRunnerSettings(raw: string | null): LocalRunnerSettings {
  if (!raw) return { ...DEFAULT_LOCAL_RUNNER };
  try {
    const parsed = JSON.parse(raw) as Partial<LocalRunnerSettings>;
    return {
      enabled: parsed.enabled === true,
      port: portOf(parsed.port),
      token: typeof parsed.token === "string" ? parsed.token.trim().slice(0, 200) : "",
    };
  } catch {
    return { ...DEFAULT_LOCAL_RUNNER };
  }
}

export function localRunnerOrigin(port: number): string {
  return `http://127.0.0.1:${portOf(port)}`;
}

export async function checkLocalRunner(settings: LocalRunnerSettings, signal?: AbortSignal): Promise<LocalRunnerHealth> {
  if (!settings.token.trim()) return { state: "down", detail: "Not connected. Paste the pairing token from the runner window." };
  let response: Response;
  try {
    response = await fetch(`${localRunnerOrigin(settings.port)}/health`, {
      method: "GET",
      headers: { [LOCAL_RUNNER_HEADER]: settings.token.trim() },
      signal,
    });
  } catch {
    return { state: "down", detail: "Not connected. Start it with node local-runner/gnosis-runner.mjs and leave that window open." };
  }
  if (response.status === 401) return { state: "down", detail: "Not connected. That pairing token does not match the runner." };
  if (!response.ok) return { state: "down", detail: "Not connected. The runner did not answer a health check." };
  let json: { compiler?: string | null; triple?: string | null; archOk?: boolean } = {};
  try {
    json = (await response.json()) as typeof json;
  } catch {
    return { state: "down", detail: "Not connected. The runner sent a health check this page could not read." };
  }
  if (!json.compiler) return { state: "connected", detail: "Connected. No g++ or clang++ is on PATH yet." };
  if (json.archOk === false) return { state: "connected", detail: `Connected. ${json.compiler} is ${json.triple || "not x86-64"}, and these exercises need x86-64.` };
  const triple = json.triple ? ` · ${json.triple}` : "";
  return { state: "connected", detail: `Connected · ${json.compiler}${triple}` };
}
