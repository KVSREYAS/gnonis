export type Settings = {
  theme: "dark" | "light";
  reader: boolean;
  motion: "system" | "reduced" | "full";
  device: "auto" | "phone" | "desktop";
};

export const DEFAULT_SETTINGS: Settings = { theme: "dark", reader: false, motion: "system", device: "auto" };
export const SETTINGS_KEY = "inference-academy:settings:v1";

export function parseSettings(raw: string | null): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      theme: s.theme === "light" ? "light" : "dark",
      reader: s.reader === true,
      motion: s.motion === "reduced" || s.motion === "full" ? s.motion : "system",
      device: s.device === "phone" || s.device === "desktop" ? s.device : "auto",
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function applySettingsToDocument(s: Settings, el: HTMLElement = document.documentElement) {
  el.dataset.theme = s.theme;
  el.dataset.reader = s.reader ? "on" : "off";
  el.dataset.motion = s.motion;
  el.dataset.deviceMode = s.device;
}

/** Runs before first paint so the saved theme never flashes. Keep in sync with applySettingsToDocument. */
export const SETTINGS_BOOT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  SETTINGS_KEY,
)})||"{}");var d=document.documentElement;d.dataset.theme=s.theme==="light"?"light":"dark";d.dataset.reader=s.reader===true?"on":"off";d.dataset.motion=s.motion==="reduced"||s.motion==="full"?s.motion:"system";d.dataset.deviceMode=s.device==="phone"||s.device==="desktop"?s.device:"auto";}catch(e){}})();`;

/** Small screens or touch-first pointers count as phones. */
export const PHONE_QUERY = "(max-width: 767px), (pointer: coarse) and (max-width: 1024px)";
