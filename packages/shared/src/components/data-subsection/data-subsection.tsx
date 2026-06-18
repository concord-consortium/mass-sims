import type { ReactNode } from "react";
import "./data-subsection.scss";

export interface DataSubsectionProps {
  children?: ReactNode;
  title: ReactNode;
}

/**
 * Sub-section primitive used inside the Data slot of `<SimulationFrame>`. Sims may render any
 * number of `<DataSubsection>` siblings; a 1 px divider is rendered automatically between
 * consecutive siblings via the `& + &` CSS rule. NOT a `<Section>` variant — the heading is a
 * real `<h3>`, semantically a sub-heading under the Data region's `<h2>`.
 */
export function DataSubsection({ children, title }: DataSubsectionProps) {
  return (
    <div className="data-subsection">
      <h3 className="heading">{title}</h3>
      <div className="body">{children}</div>
    </div>
  );
}
