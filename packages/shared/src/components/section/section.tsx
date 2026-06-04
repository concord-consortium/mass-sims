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
 * VISUAL TREATMENT IS A PLACEHOLDER (see docs/simulation-frame-plan.md). Final chip
 * styling, background, shadow, and padding scale arrive via tokens.scss when designs land.
 */
export function Section({ title, instruction, className, children }: SectionProps) {
  const titleId = useId();
  return (
    <section className={clsx("section", className)} aria-labelledby={titleId}>
      <div className="chip">
        <h2 id={titleId} className="title">
          {title}
        </h2>
        {instruction ? <div className="instruction">{instruction}</div> : null}
      </div>
      <div className="content">{children}</div>
    </section>
  );
}
