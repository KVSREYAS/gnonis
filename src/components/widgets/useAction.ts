import { useEffect, useRef } from "react";
import type { PrimaryAction } from "./types";

/**
 * Publishes the widget's primary action to the player's action bar. The press handler is read
 * through a ref so the action does not go stale between renders.
 */
export function usePrimaryAction(
  setAction: (a: PrimaryAction | null) => void,
  action: (PrimaryAction & { hidden?: boolean }) | null,
) {
  const handler = useRef(action?.onPress);
  useEffect(() => {
    handler.current = action?.onPress;
  });
  const label = action?.label;
  const disabled = action?.disabled;
  const busy = action?.busy;
  const hidden = action?.hidden ?? !action;
  useEffect(() => {
    if (hidden || label === undefined) {
      setAction(null);
      return;
    }
    setAction({ label, disabled, busy, onPress: () => handler.current?.() });
  }, [setAction, label, disabled, busy, hidden]);
  useEffect(() => () => setAction(null), [setAction]);
}
