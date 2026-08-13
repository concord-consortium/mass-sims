import { ERA_MARKERS, timelinePosition, YEARS_SINCE_COLLAPSE } from "../model/sim";
import "./timeline.scss";

interface TimelineProps {
  /** Years before the collapse currently being sampled. */
  sampledYear: number;
}

function shortYears(yearsAgo: number): string {
  if (yearsAgo >= 1_000_000) return `${Math.round(yearsAgo / 1_000_000)} Mya`;
  return `${Math.round(yearsAgo).toLocaleString()} yr`;
}

/**
 * A *display* timeline (not a control). A 200,000-year span is impossible to place a slider thumb on
 * consistently, so instead we show where the sampled point falls among familiar reference events on
 * a logarithmic "years ago" axis — from trilobites to the Corvette Museum.
 */
export function Timeline({ sampledYear }: TimelineProps) {
  // The collapse (2014) sits a few years back from the present-day end, so offset the marker.
  const samplePos = timelinePosition(sampledYear + YEARS_SINCE_COLLAPSE);
  return (
    <div className="timeline">
      <div className="timeline-track">
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
          <span className="sample-flag">
            Sampling
            <span className="sample-age">{shortYears(sampledYear)} before collapse</span>
          </span>
          <span className="sample-line" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
