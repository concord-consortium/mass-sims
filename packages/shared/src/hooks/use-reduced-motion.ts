import { useEffect, useState } from "react";
import { prefersReducedMotion } from "../utils/reduced-motion";

/**
 * The user's `prefers-reduced-motion` setting, kept live: seeded from the current value and updated when
 * the OS setting changes mid-session (the `prefersReducedMotion` snapshot util is not reactive on its own).
 * Guarded for jsdom/SSR, where `matchMedia` is absent and it defaults to false (motion allowed).
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
