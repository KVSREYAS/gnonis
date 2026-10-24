import { PHONE_QUERY, SETTINGS_KEY } from "@/lib/settings";

/** Persisted when the learner opens or closes Dive deeper. Absent means "use the device default". */
export const DIVE_PANEL_STORAGE_KEY = "gnosis:dive-panel";

export type DivePanelChoice = "open" | "closed";

export function parseDivePanelChoice(value: string | null | undefined): DivePanelChoice | null {
  return value === "open" || value === "closed" ? value : null;
}

/**
 * Desktop and other wide layouts start open when chat is on. Phone layouts start closed.
 * A saved choice wins on every later lesson until the learner toggles it again.
 */
export function resolveDivePanelOpen(input: { chatEnabled: boolean; phone: boolean; choice: DivePanelChoice | null }): boolean {
  if (!input.chatEnabled) return false;
  if (input.choice === "open") return true;
  if (input.choice === "closed") return false;
  return !input.phone;
}

/**
 * Runs from <head> before first paint. Sets data-dive-panel and data-dive-layout on <html> so the
 * lesson action bar can reserve drawer space without waiting for React. Keep the decision in sync
 * with resolveDivePanelOpen: saved choice, then phone vs desktop, including a forced device mode.
 */
export const DIVE_PANEL_BOOT_SCRIPT = `(function(){try{var pref=localStorage.getItem(${JSON.stringify(DIVE_PANEL_STORAGE_KEY)});var settings={};try{settings=JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_KEY)})||"{}")}catch(e){}var forced=settings&&settings.device;var phoneQuery=window.matchMedia(${JSON.stringify(PHONE_QUERY)}).matches;var phone=forced==="phone"||(forced!=="desktop"&&phoneQuery);var open=pref==="open"?!0:pref==="closed"?!1:!phone;var root=document.documentElement;root.dataset.divePanel=open?"open":"closed";root.dataset.diveLayout=phone?"sheet":"drawer";}catch(e){}})();`;
