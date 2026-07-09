/**
 * True when the sim is running inside an iframe (e.g. embedded in Activity Player) rather than as
 * the top-level document. Unlike the async AP handshake (`useInitMessage()`, which is `null` until
 * the init message lands post-first-paint), this is a **synchronous** signal available on the very
 * first render — so an embedded sim can suppress its standalone chrome without a flash.
 *
 * Comparing the `self`/`top` window references is safe across origins (it never touches a
 * cross-origin property); the `try/catch` is belt-and-suspenders for locked-down environments where
 * even the reference access throws, in which case we're framed. Guarded for jsdom/SSR (no `window`),
 * where it defaults to false (top-level).
 */
export function inIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}
