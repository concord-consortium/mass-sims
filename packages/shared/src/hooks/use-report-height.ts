import { setHeight } from "@concord-consortium/lara-interactive-api";
import { useEffect } from "react";
import { FRAME_HEIGHT } from "../layout/target-widths";

/**
 * Report the sim's render height to the embedding host (Activity Player) so it sizes the iframe to
 * exactly what we draw.
 *
 * Without a reported height AP guesses: it derives the iframe height from `width / aspectRatio` (a
 * 4/3 default), which for our wide, short layout is much taller than we render — leaving a band of
 * white space below the sim. `setHeight` makes AP use the given pixel height instead (see AP's
 * `useSizeAndAspectRatio`, DEFAULT branch).
 *
 * We report the `FRAME_HEIGHT` constant rather than measuring the DOM: the sims are fixed-height and
 * only flex horizontally (see `layout/target-widths.ts`), so the constant IS the height.
 *
 * Caveats:
 *  - AP honors a reported height only when the interactive is authored with the DEFAULT aspect-ratio
 *    method; MANUAL/MAX ignore it. If the white space persists, check `aspect_ratio_method`.
 *  - Reporting a height disables AP's shrink-to-fit, but 562px fits any reasonable window.
 *
 * The call is fire-and-forget — iframe-phone queues it until the host connects, so calling before AP
 * is ready is fine — and try/catch'd like `useLogEvent`, since the client throws if it can't
 * initialize.
 */
export function useReportHeight(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    try {
      setHeight(FRAME_HEIGHT);
    } catch {
      // lara-interactive-api throws if it can't initialize — treat as a no-op.
    }
  }, [enabled]);
}
