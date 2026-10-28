import type { Conditions } from "./erosion";

/**
 * The image source for a sample's cross-section drawing, or `null` when there is none. There are no
 * drawings yet (MAS-59), so every row shows the stand-in. To add them, put the files in
 * `src/assets/cave/` and return their URLs here.
 */
export function caveArtFor(_conditions: Conditions, _years: number): string | null {
  return null;
}
