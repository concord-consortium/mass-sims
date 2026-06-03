import { useEffect } from "react";

/**
 * When `enabled` is true, registers a `beforeunload` listener that asks the browser to show
 * its native "Leave site?" confirmation. Use this to prevent accidental loss of in-memory work
 * (e.g., recorded trials that aren't persisted across reloads).
 *
 * Modern browsers ignore any custom message and show a fixed prompt; the only contract is that
 * the handler call `preventDefault()` and set `returnValue` (the latter being a legacy quirk
 * still required by some Chromium builds).
 *
 * When `enabled` is false the listener is removed, so reloads happen silently.
 */
export function useReloadWarning(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // `returnValue` is deprecated but kept for compatibility with browsers that still check it.
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [enabled]);
}
