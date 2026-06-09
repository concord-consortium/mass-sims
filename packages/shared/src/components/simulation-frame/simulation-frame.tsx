import clsx from "clsx";
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import ccLogo from "../../assets/branding/cc-logo.svg";
import deseLogo from "../../assets/branding/dese-logo.svg";
import closeIcon from "../../assets/close-icon.svg";
import infoIcon from "../../assets/info-icon.svg";
import { Section } from "../section/section";
import "./simulation-frame.scss";

export interface SimulationFrameProps {
  children?: ReactNode;
  infoModalContent?: ReactNode;
  simTitle: string;
  standalone?: boolean;
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
      <div className="trials-list">{children}</div>
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
 * STRUCTURE ONLY — visual specifics live in tokens.scss. Trials is fixed at 155 px;
 * Simulation and Data flex in a 564 : 285 ratio so the layout adapts to all four
 * container widths (1044 / 1024 / 989 / 767). The `standalone` prop toggles a
 * 2 px / 10 px-radius outer container that AP-embedded sims suppress so AP's chrome is
 * the only container.
 */
export function SimulationFrame({
  simTitle,
  tagline,
  infoModalContent,
  children,
  standalone,
}: SimulationFrameProps) {
  const urlStandalone = useUrlStandaloneParam();
  const effectiveStandalone = standalone ?? urlStandalone ?? true;
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

  // The About panel is a draggable, non-modal side panel anchored top-right of the frame.
  // Its position is a transform offset from that CSS anchor.
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Toggle the panel from the About button (clicking it while open closes it, like the demo).
  // Opening resets the panel to its default position. We reset synchronously here — batched
  // with the open in the same render — rather than in a post-open effect, so the panel never
  // flashes for a frame at its previously-dragged location before snapping back to default.
  const toggleInfo = () => {
    if (!infoOpen) setDragOffset({ x: 0, y: 0 });
    setInfoOpen((open) => !open);
  };

  // Tears down an in-progress drag's window listeners. Held in a ref so it can be invoked both
  // on pointerup (normal end) and on unmount (if the frame is removed mid-drag, before any
  // pointerup fires — otherwise those window listeners would outlive the component).
  const dragCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => dragCleanupRef.current?.(), []);

  // Pointer-driven drag from the header. We attach the move/up listeners to the window for the
  // duration of the gesture (rather than pointer capture) so it keeps tracking even if the
  // pointer leaves the header. A pointerdown on the close button does not start a drag.
  const beginDrag = (e: ReactPointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest(".modal-close")) return;
    // Tear down any still-active gesture before starting a new one, so a second pointerdown
    // (e.g. a second touch, or a prior drag that ended in pointercancel rather than pointerup)
    // can't stack a second set of window listeners that fight over the offset.
    dragCleanupRef.current?.();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = dragOffset.x;
    const originY = dragOffset.y;
    const onMove = (move: PointerEvent) => {
      setDragOffset({ x: originX + (move.clientX - startX), y: originY + (move.clientY - startY) });
    };
    // `stop` ends the gesture on pointerup OR pointercancel (the latter fires instead of
    // pointerup when the browser/OS aborts the pointer), and is also the stored unmount-cleanup
    // — so the remove-listener logic lives in exactly one place.
    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      dragCleanupRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    dragCleanupRef.current = stop;
  };

  return (
    <div className={clsx("simulation-frame", effectiveStandalone && "standalone")}>
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
              aria-expanded={infoOpen}
              aria-haspopup="dialog"
              className="info-button"
              ref={triggerRef}
              type="button"
              onClick={toggleInfo}
            >
              <img src={infoIcon} alt="" aria-hidden="true" className="info-button-icon" />
              About
            </button>
          ) : null}
        </div>
      </header>

      {children}

      {infoModalContent && infoOpen ? (
        <div
          aria-labelledby={titleId}
          className="simulation-frame-info-modal"
          role="dialog"
          style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setInfoOpen(false);
              return;
            }
            // Keyboard dragging: Alt+Arrow nudges the panel (Shift for a larger step), so the
            // panel is repositionable without a pointer. Mirrors the demo.
            if (!e.altKey) return;
            const step = e.shiftKey ? 40 : 10;
            const delta =
              e.key === "ArrowLeft"
                ? { x: -step, y: 0 }
                : e.key === "ArrowRight"
                  ? { x: step, y: 0 }
                  : e.key === "ArrowUp"
                    ? { x: 0, y: -step }
                    : e.key === "ArrowDown"
                      ? { x: 0, y: step }
                      : null;
            if (!delta) return;
            e.preventDefault();
            setDragOffset((offset) => ({ x: offset.x + delta.x, y: offset.y + delta.y }));
          }}
        >
          <header className="modal-drag-handle" onPointerDown={beginDrag}>
            <img src={infoIcon} alt="" aria-hidden="true" className="modal-header-icon" />
            <h2 className="modal-title" id={titleId}>
              About the {simTitle} Simulation
            </h2>
            <button
              aria-label="Close"
              className="modal-close"
              ref={closeRef}
              type="button"
              onClick={() => setInfoOpen(false)}
            >
              <img src={closeIcon} alt="" aria-hidden="true" className="modal-close-icon" />
            </button>
          </header>
          <div className="modal-body">{infoModalContent}</div>
        </div>
      ) : null}
    </div>
  );
}

SimulationFrame.Trials = Trials;
SimulationFrame.Simulation = Simulation;
SimulationFrame.Data = Data;

function useUrlStandaloneParam(): boolean | undefined {
  return useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const v = new URLSearchParams(window.location.search).get("standalone");
    if (v === "false") return false;
    if (v === "true") return true;
    return undefined;
  }, []);
}
