import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  COLLAPSE_SPAN_YEARS,
  ERA_MARKERS,
  stepSampleYear,
  timelinePosition,
  YEARS_SINCE_COLLAPSE,
  yearsBeforeAtPosition,
} from "../model/sim";
import "./timeline.scss";

interface TimelineProps {
  /** Years before the collapse currently being sampled. */
  sampledYear: number;
  /** When provided, the timeline becomes a control: clicking or dragging it sets years-before-collapse. */
  onScrub?: (yearsBefore: number) => void;
}

function shortYears(yearsAgo: number): string {
  if (yearsAgo >= 1_000_000) return `${Math.round(yearsAgo / 1_000_000)} Mya`;
  return `${Math.round(yearsAgo).toLocaleString()} yr`;
}

/**
 * Shows where the sampled point falls among familiar reference events on a logarithmic "years ago" axis
 * (trilobites to the Corvette Museum). When `onScrub` is given it doubles as a control: click or drag
 * anywhere on the track to set the sampled year (the log inverse of the sample marker's placement),
 * clamped to the samplable span. The stepper remains for precise/keyboard-only adjustment.
 */
export function Timeline({ sampledYear, onScrub }: TimelineProps) {
  // The collapse (2014) sits a few years back from the present-day end, so offset the marker.
  const samplePos = timelinePosition(sampledYear + YEARS_SINCE_COLLAPSE);
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const scrubToClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || !onScrub) return;
      const rect = el.getBoundingClientRect();
      onScrub(yearsBeforeAtPosition((clientX - rect.left) / rect.width));
    },
    [onScrub],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onScrub) return;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    scrubToClientX(e.clientX);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) scrubToClientX(e.clientX);
  };
  const stopDragging = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) {
      draggingRef.current = false;
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onScrub) return;
    // Match the stepper: ← older (more years before collapse), → more recent (fewer).
    if (e.key === "ArrowLeft") {
      onScrub(stepSampleYear(sampledYear, 1));
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      onScrub(stepSampleYear(sampledYear, -1));
      e.preventDefault();
    }
  };

  // Keep the sample line on the marker but align the flag so it never spills off either end: centered
  // in the middle, left-aligned when it would overflow the left edge, right-aligned near the right.
  const flagRef = useRef<HTMLSpanElement>(null);
  const [flagAlign, setFlagAlign] = useState<"center" | "left" | "right">("center");
  useLayoutEffect(() => {
    const track = trackRef.current;
    const flag = flagRef.current;
    if (!track || !flag) return;
    const compute = () => {
      const tw = track.clientWidth;
      const fw = flag.offsetWidth;
      if (!tw || !fw) return;
      const centerX = samplePos * tw;
      const half = fw / 2;
      setFlagAlign(centerX - half < 0 ? "left" : centerX + half > tw ? "right" : "center");
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(track);
    return () => ro.disconnect();
  }, [samplePos]);

  // Only attach the slider role/aria/handlers when interactive, so the display-only timeline stays a
  // plain element (and passes the a11y lints, which require the role for the aria props + handlers).
  const controlProps: React.HTMLAttributes<HTMLDivElement> = onScrub
    ? {
        role: "slider",
        tabIndex: 0,
        "aria-label": "Years before collapse to sample",
        "aria-valuemin": 0,
        "aria-valuemax": COLLAPSE_SPAN_YEARS,
        "aria-valuenow": sampledYear,
        "aria-valuetext": `${sampledYear.toLocaleString()} years before collapse`,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: stopDragging,
        onPointerCancel: stopDragging,
        onKeyDown: handleKeyDown,
      }
    : {};

  return (
    <div className="timeline">
      <div
        ref={trackRef}
        className={`timeline-track${onScrub ? " interactive" : ""}`}
        {...controlProps}
      >
        {ERA_MARKERS.map((m, i) => {
          const edge = i === 0 ? "edge-left" : i === ERA_MARKERS.length - 1 ? "edge-right" : "";
          return (
            <div
              key={m.label}
              className={`era-marker ${i % 2 === 0 ? "above" : "below"} ${edge}`}
              style={{ left: `${timelinePosition(m.yearsAgo) * 100}%` }}
            >
              <span className="era-tick" aria-hidden="true" />
              <span className="era-label">
                <span className="era-icon" aria-hidden="true">
                  {m.icon}
                </span>
                {m.label}
                <span className="era-age">{shortYears(m.yearsAgo)}</span>
              </span>
            </div>
          );
        })}

        <div className="now-marker" aria-hidden="true">
          <span className="now-label">2026</span>
          <span className="now-tick" />
        </div>

        <div className="sample-marker" style={{ left: `${samplePos * 100}%` }}>
          <span ref={flagRef} className={`sample-flag align-${flagAlign}`}>
            Sampling
            <span className="sample-age">{shortYears(sampledYear)} before collapse</span>
          </span>
          <span className="sample-line" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
