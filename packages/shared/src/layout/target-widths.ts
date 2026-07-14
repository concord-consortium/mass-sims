/**
 * The exact widths and height every sim's layout must work within, per
 * [ui-design-plan.md §6](../../../../docs/ui-design-plan.md). Driven by the Activity Player's
 * embedding modes; the height is fixed across all of them (it's the height AP gives the iframe).
 *
 * This module is the single source of truth for these numbers in TypeScript. It's consumed by the
 * width-preview page (which renders the sim in an iframe per entry) and by `playwright.config.ts`
 * (which runs the whole e2e suite once per width). Keep it PURE — no component, SCSS, or SVG
 * imports — so `playwright.config.ts` can import it directly without the barrel dragging in
 * side-effects its tsconfig can't resolve.
 *
 * `tokens.scss` carries its own copy; it points back here.
 */

export const FRAME_HEIGHT = 562;
export const STANDALONE_BORDER_WIDTH = 2;
export const STANDALONE_OUTER_HEIGHT = FRAME_HEIGHT + STANDALONE_BORDER_WIDTH * 2; // 566

export interface TargetWidth {
  px: number;
  label: string;
  standalone: boolean;
}

export const TARGET_WIDTHS: readonly TargetWidth[] = [
  { px: 1044, label: "Activity Player — full width", standalone: false },
  { px: 1024, label: "Standalone", standalone: true },
  { px: 989, label: "Activity Player — 2-column, left column hidden", standalone: false },
  { px: 767, label: "Activity Player — 2-column, left column displayed", standalone: false },
];

export const TARGET_WIDTH_PX: readonly number[] = TARGET_WIDTHS.map((w) => w.px);

export function outerHeightFor(standalone: boolean): number {
  return standalone ? STANDALONE_OUTER_HEIGHT : FRAME_HEIGHT;
}
