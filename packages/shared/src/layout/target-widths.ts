/**
 * The exact widths and height every sim's layout must work within, per
 * [ui-design-plan.md §6](../../../../docs/ui-design-plan.md). Driven by the Activity Player's
 * embedding modes; the height is fixed across all of them (it's the height AP gives the iframe).
 *
 * This module is the **single source of truth** for these numbers, everywhere. It's consumed by the
 * width-preview page (which renders the sim in an iframe per entry), by `playwright.config.ts` (which
 * runs the whole e2e suite once per width), and — via `yarn gen-widths` — by the SCSS: the generator
 * emits `styles/_widths.generated.scss`, which `tokens.scss` forwards. CI runs `gen-widths --check`,
 * so editing a width here without regenerating fails the build.
 *
 * Keep it PURE — no component, SCSS, or SVG imports. `playwright.config.ts` imports it directly
 * (bypassing the barrel, which would drag in side-effects its tsconfig can't resolve), and so does
 * the generator script, which runs in plain Node via tsx.
 */

export const FRAME_HEIGHT = 562;
export const STANDALONE_BORDER_WIDTH = 2;
export const STANDALONE_OUTER_HEIGHT = FRAME_HEIGHT + STANDALONE_BORDER_WIDTH * 2; // 566

export interface TargetWidth {
  /**
   * Stable identifier for this mode. Becomes the generated SCSS variable name
   * (`$frame-width-<token>`), so renaming one renames a token every stylesheet reads — regenerate
   * and update the consumers together.
   */
  token: string;
  px: number;
  label: string;
  standalone: boolean;
}

export const TARGET_WIDTHS: readonly TargetWidth[] = [
  {
    token: "ap-full",
    px: 1044,
    label: "Activity Player — full width",
    standalone: false,
  },
  {
    token: "standalone",
    px: 1024,
    label: "Standalone",
    standalone: true,
  },
  {
    token: "ap-2col-hidden",
    px: 989,
    label: "Activity Player — 2-column, left column hidden",
    standalone: false,
  },
  {
    token: "ap-2col-shown",
    px: 767,
    label: "Activity Player — 2-column, left column displayed",
    standalone: false,
  },
];

export const TARGET_WIDTH_PX: readonly number[] = TARGET_WIDTHS.map((w) => w.px);

export function outerHeightFor(standalone: boolean): number {
  return standalone ? STANDALONE_OUTER_HEIGHT : FRAME_HEIGHT;
}
