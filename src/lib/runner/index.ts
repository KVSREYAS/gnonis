import { PyodideRunner } from "./pyodide-runner";
import type { CodeRunner, RunLanguage } from "./types";

export type { CodeRunner, RunRequest, RunResult, RunLanguage } from "./types";

const factories: Partial<Record<RunLanguage, () => CodeRunner>> = {
  python: () => new PyodideRunner(),
};
const instances = new Map<RunLanguage, CodeRunner>();

/** Swap in another runner for a language. C++ is not registered here: it runs on the server. */
export function registerRunner(language: RunLanguage, factory: () => CodeRunner) {
  factories[language] = factory;
  instances.get(language)?.dispose?.();
  instances.delete(language);
}

export function getRunner(language: RunLanguage): CodeRunner {
  let r = instances.get(language);
  if (!r) {
    const make = factories[language];
    if (!make) throw new Error(`No code runner registered for ${language}`);
    r = make();
    instances.set(language, r);
  }
  return r;
}
