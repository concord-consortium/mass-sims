import clsx from "clsx";
import { type ReactNode, useId } from "react";
import { useScrollFocusRing } from "../../hooks/use-scroll-focus-ring";
import "./section.scss";

export interface SectionProps {
  children?: ReactNode;
  className?: string;
  instruction?: ReactNode;
  scrollFocusRing?: boolean;
  title: string;
}

/**
 * Labeled, rounded region used by all three SimulationFrame slots and by sims that add
 * sub-sections inside the Data slot. The title chip is a real heading element so screen
 * readers announce it and `aria-labelledby` exposes the section as a named region.
 */
export function Section({
  title,
  instruction,
  className,
  scrollFocusRing,
  children,
}: SectionProps) {
  const titleId = useId();
  // Callback ref: always called to keep hook order stable — it only observes an element when
  // one is attached, which happens only in the scrollFocusRing branch below.
  const contentRef = useScrollFocusRing<HTMLDivElement>();

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
      {scrollFocusRing ? (
        <div className="content-wrap">
          <div className="content scroll-region" ref={contentRef}>
            {children}
          </div>
          <div className="scroll-focus-ring" aria-hidden="true" />
        </div>
      ) : (
        <div className="content">{children}</div>
      )}
    </section>
  );
}
