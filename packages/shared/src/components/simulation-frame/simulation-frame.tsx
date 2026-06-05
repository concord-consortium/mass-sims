import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Section } from "../section/section";

import ccLogo from "./branding/cc-logo.svg";
import deseLogo from "./branding/dese-logo.svg";
import infoIcon from "./branding/info-icon.svg";
import "./simulation-frame.scss";

export interface SimulationFrameProps {
  children?: ReactNode;
  infoModalContent?: ReactNode;
  simTitle: string;
  tagline: string;
}

interface SlotProps {
  children?: ReactNode;
  title?: string;
}
interface SimulationSlotProps extends SlotProps {
  /** Optional instruction shown beside the Simulation section title. */
  instruction?: ReactNode;
}

// Slot components render their children into the correct grid-area-tagged Section.
// They render directly (no Context/Children gymnastics): grid-area placement makes the
// visual order independent of source order, which keeps the slot API order-tolerant.
// The grid-area class (e.g. "trials-area") is passed to Section's className; Section
// composes it with its own root class as clsx("section", className).
function Trials({ children, title = "Trials" }: SlotProps) {
  return (
    <Section title={title} className="trials-area">
      {children}
    </Section>
  );
}

function Simulation({ children, instruction, title = "Simulation" }: SimulationSlotProps) {
  return (
    <Section title={title} instruction={instruction} className="simulation-area">
      {children}
    </Section>
  );
}

function Data({ children, title = "Data" }: SlotProps) {
  return (
    <Section title={title} className="data-area">
      {children}
    </Section>
  );
}

/**
 * Three-region simulation shell implementing the §3 API contract (infrastructure-plan.md).
 * STRUCTURE ONLY — wide-mode grid; visual specifics live in tokens.scss. Narrow mode (676 px)
 * collapse behavior is deferred (ui-design-plan.md §8/Q30).
 */
export function SimulationFrame({
  simTitle,
  tagline,
  infoModalContent,
  children,
}: SimulationFrameProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const titleId = useId();

  // Focus management: move focus to the close button on open, and return it to the info
  // button (the trigger) on close — standard dialog etiquette so keyboard users aren't
  // stranded. The `wasOpenRef` guard ensures we only restore focus on a real open→close
  // transition, never on the initial render (when `infoOpen` already starts false).
  // Full focus-trapping (Tab cycling within the modal) is still deferred to the shared
  // Dialog component — TODO Phase 2/3.
  useEffect(() => {
    if (infoOpen) {
      wasOpenRef.current = true;
      closeRef.current?.focus();
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
    }
  }, [infoOpen]);

  return (
    <div className="simulation-frame">
      <header className="title-bar">
        <div className="title-bar-left">
          <h1 className="sim-title">{simTitle}</h1>
          <span className="tagline">{tagline}</span>
        </div>
        <div className="title-bar-right">
          <img className="partner-logo" src={deseLogo} alt="DESE" />
          <img className="partner-logo" src={ccLogo} alt="Concord Consortium" />
          {infoModalContent ? (
            <button
              aria-haspopup="dialog"
              className="info-button"
              ref={triggerRef}
              type="button"
              onClick={() => setInfoOpen(true)}
            >
              <img src={infoIcon} alt="" aria-hidden="true" className="info-button-icon" />
              About
            </button>
          ) : null}
        </div>
      </header>

      {children}

      {infoModalContent && infoOpen
        ? createPortal(
            // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismissal is a convenience; Escape and the close button are the keyboard-accessible paths.
            // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismissal is a convenience; Escape and the close button are the keyboard-accessible paths.
            <div
              className="simulation-frame-info-overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget) setInfoOpen(false);
              }}
            >
              <div
                aria-labelledby={titleId}
                aria-modal="true"
                className="modal"
                role="dialog"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setInfoOpen(false);
                }}
              >
                <h2 id={titleId}>About the {simTitle} Simulation</h2>
                {infoModalContent}
                <button
                  className="modal-close"
                  ref={closeRef}
                  type="button"
                  onClick={() => setInfoOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

SimulationFrame.Trials = Trials;
SimulationFrame.Simulation = Simulation;
SimulationFrame.Data = Data;
