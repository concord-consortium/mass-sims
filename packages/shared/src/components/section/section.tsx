import clsx from "clsx";
import { type ReactNode, useId } from "react";
import "./section.scss";

export interface SectionProps {
  children?: ReactNode;
  className?: string;
  instruction?: ReactNode;
  title: string;
}

/**
 * Labeled, rounded region used by all three SimulationFrame slots and by sims that add
 * sub-sections inside the Data slot. The title chip is a real heading element so screen
 * readers announce it and `aria-labelledby` exposes the section as a named region.
 *
 * Token values (color, radius, border, type) are derived from the realized demo design. The
 * title chip uses the demo's notched floating treatment — a centered pill straddling the panel's
 * top edge, with an optional `•`-separated instruction (see section.scss).
 */
export function Section({ title, instruction, className, children }: SectionProps) {
  const titleId = useId();
  return (
    <section className={clsx("section", className)} aria-labelledby={titleId}>
      <div className="chip">
        {/* Heading is fixed at <h2> — Section labels the three top-level frame regions.
            Sub-sections inside the Data slot use the separate <DataSubsection> component, which
            renders an <h3> under the Data region's <h2> for a correct nested heading outline. */}
        <h2 id={titleId} className="title">
          {title}
        </h2>
        {instruction ? <div className="instruction">{instruction}</div> : null}
      </div>
      <div className="content">{children}</div>
    </section>
  );
}
