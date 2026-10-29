import { caveArtFor } from "../../model/cave-art";
import type { Conditions } from "../../model/erosion";

/**
 * A row's cross-section picture. Hidden from assistive tech: the row's label already carries its
 * numbers. Draws the green stand-in until `caveArtFor` has a drawing.
 */
export function Thumbnail({ conditions, years }: { conditions: Conditions; years: number }) {
  const src = caveArtFor(conditions, years);
  if (src) return <img className="collapse-pic-img" src={src} alt="" aria-hidden="true" />;
  return <span className="collapse-pic-standin" aria-hidden="true" />;
}
