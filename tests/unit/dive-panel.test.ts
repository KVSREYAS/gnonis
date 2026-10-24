import { describe, expect, it } from "vitest";
import { DIVE_PANEL_BOOT_SCRIPT, DIVE_PANEL_STORAGE_KEY, parseDivePanelChoice, resolveDivePanelOpen } from "@/lib/chat/dive-panel";
import { PHONE_QUERY, SETTINGS_KEY } from "@/lib/settings";

describe("dive deeper open state", () => {
  it("opens on desktop by default and stays closed on a phone", () => {
    expect(resolveDivePanelOpen({ chatEnabled: true, phone: false, choice: null })).toBe(true);
    expect(resolveDivePanelOpen({ chatEnabled: true, phone: true, choice: null })).toBe(false);
    expect(resolveDivePanelOpen({ chatEnabled: false, phone: false, choice: null })).toBe(false);
  });

  it("keeps a saved close until the learner opens it again", () => {
    expect(parseDivePanelChoice("closed")).toBe("closed");
    expect(parseDivePanelChoice("nope")).toBeNull();
    expect(resolveDivePanelOpen({ chatEnabled: true, phone: false, choice: "closed" })).toBe(false);
    expect(resolveDivePanelOpen({ chatEnabled: true, phone: true, choice: "open" })).toBe(true);
    expect(resolveDivePanelOpen({ chatEnabled: false, phone: false, choice: "open" })).toBe(false);
  });

  it("bakes the same storage key and phone query into the pre-paint script", () => {
    expect(DIVE_PANEL_BOOT_SCRIPT).toContain(JSON.stringify(DIVE_PANEL_STORAGE_KEY));
    expect(DIVE_PANEL_BOOT_SCRIPT).toContain(JSON.stringify(SETTINGS_KEY));
    expect(DIVE_PANEL_BOOT_SCRIPT).toContain(JSON.stringify(PHONE_QUERY));
    expect(DIVE_PANEL_BOOT_SCRIPT).toContain("dataset.divePanel");
    expect(DIVE_PANEL_BOOT_SCRIPT).toContain("dataset.diveLayout");
    expect(() => new Function(DIVE_PANEL_BOOT_SCRIPT)).not.toThrow();
  });
});
