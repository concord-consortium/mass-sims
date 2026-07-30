import { useEffect, useState } from "react";

/**
 * Whether the document is currently hidden (a backgrounded tab), kept live via `visibilitychange` — so a
 * consumer can pause an animation off-screen. Guarded for jsdom/SSR, where `document` is absent → false.
 */
export function useDocumentHidden(): boolean {
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  return hidden;
}
