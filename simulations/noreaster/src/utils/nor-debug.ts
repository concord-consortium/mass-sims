/**
 * Diagnostic flags read off `window`. They ship in production (nothing is stripped from a prod build) but
 * are unreachable without an explicit `window.__nor*` assignment — never from the URL, so a host that
 * composes query strings can't reach them. Don't gate anything sensitive on them. The Playwright perf probe
 * sets `__norPerf` via `addInitScript` before the page loads; a developer can set `window.__norNoFilter =
 * true` in the console to preview the Safari blur fallback on a filter-capable device.
 */
interface NorDebugWindow extends Window {
  __norPerf?: boolean;
  __norNoFilter?: boolean;
}

/** True when the namespaced dev flag is set on `window` (browser only). */
export function norDebugFlag(name: "__norPerf" | "__norNoFilter"): boolean {
  return typeof window !== "undefined" && (window as NorDebugWindow)[name] === true;
}
