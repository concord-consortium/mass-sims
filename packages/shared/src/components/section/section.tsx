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
 */
export function Section({ title, instruction, className, children }: SectionProps) {
  const titleId = useId();
  return (
    <section className={clsx("section", className)} aria-labelledby={titleId}>
      <div className="chip">
        <h2 id={titleId} className="title">
          <span className="chip-text">{title}</span>
        </h2>
        {instruction ? (
          <div className="instruction">
            <span className="chip-text">{instruction}</span>
          </div>
        ) : null}
      </div>
      <div className="content">{children}</div>
    </section>
  );
}
