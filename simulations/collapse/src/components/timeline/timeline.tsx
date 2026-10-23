import { observer } from "mobx-react-lite";
import {
  Fragment,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useSetSampleYears } from "../../hooks/use-set-sample-years";
import {
  currentYear,
  formatYears,
  TIMELINE_SEGMENTS,
  TIMELINE_STOPS,
  TIMELINE_VALUES,
} from "../../model/timeline";
import {
  layoutTimeline,
  nearestValueIndexByPx,
  type TimelineLayout,
} from "../../model/timeline-layout";
import { useStores } from "../../stores/root-store";
import { measureLineWidths } from "./measure-line-widths";
import "./timeline.scss";

/** The flag's design width; the fallback when it has not rendered yet. */
const FLAG_WIDTH = 158;
const LAST = TIMELINE_VALUES.length - 1;

/** Each value's design position as a track fraction, used only until the first measurement. */
const DESIGN_VALUE_AT = TIMELINE_SEGMENTS.map((sg) => {
  const a = TIMELINE_STOPS[sg.hi].at;
  return a + sg.t * (TIMELINE_STOPS[sg.hi + 1].at - a);
});
const ZERO_AT = TIMELINE_STOPS[TIMELINE_STOPS.length - 2].at;

interface Measured {
  layout: TimelineLayout;
  trackWidth: number;
  flagWidth: number;
}

const pct = (fraction: number) => `${fraction * 100}%`;

/**
 * The timeline: dated landmarks the student reads, and a flag (`role="slider"`) that picks one of
 * `TIMELINE_VALUES`. Stop positions come from measured label widths (`layoutTimeline`), so they are
 * re-laid out on resize and after the web font loads.
 *
 * Two press targets behave differently on purpose. Pressing the stops band snaps to the nearest value
 * and keeps following the pointer. Pressing the flag does not change the value: the drag keeps the
 * pointer's offset from the handle, so the value only moves once the handle is dragged to another one.
 */
export const Timeline = observer(function Timeline() {
  const { ui } = useStores();
  const { set, step } = useSetSampleYears();
  const tlRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLOListElement>(null);
  const flagRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<Measured | null>(null);
  const [dragging, setDragging] = useState(false);
  // The pointer's x offset from the handle while a drag is live; `null` when not dragging.
  const grabOffset = useRef<number | null>(null);
  // Chrome shows the focus ring when a pointer press on the band focuses the flag, but the ring is
  // for keyboard users. `noRing` hides it after a press; any other focus, a blur, or a key brings it
  // back. `pressFocus` marks the focus a band press causes, which is the one focus that keeps it.
  const [noRing, setNoRing] = useState(false);
  const pressFocus = useRef(false);

  const relayout = useCallback(() => {
    const tl = tlRef.current;
    const row = rowRef.current;
    if (!tl || !row?.clientWidth) return;
    const stopEls = Array.from(row.children) as HTMLElement[];
    const layout = layoutTimeline({
      rowWidth: row.clientWidth,
      stopLineWidths: stopEls.map(measureLineWidths),
      stops: TIMELINE_STOPS,
      segments: TIMELINE_SEGMENTS,
    });
    setMeasured({
      layout,
      trackWidth: tl.clientWidth,
      flagWidth: flagRef.current?.offsetWidth || FLAG_WIDTH,
    });
  }, []);

  useLayoutEffect(() => {
    const tl = tlRef.current;
    const row = rowRef.current;
    if (!tl || !row) return;
    relayout();
    // Watch the end stops as well as the track: their widths set the inset, and they change when the
    // web font swaps in after the first frame.
    const observer = new ResizeObserver(relayout);
    observer.observe(tl);
    if (row.firstElementChild) observer.observe(row.firstElementChild);
    if (row.lastElementChild) observer.observe(row.lastElementChild);
    let live = true;
    document.fonts?.ready.then(() => {
      if (live) relayout();
    });
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [relayout]);

  const index = ui.timelineIndex;
  const years = ui.sampleYears;

  const pointerX = (e: PointerEvent) =>
    e.clientX - (tlRef.current?.getBoundingClientRect().left ?? 0);

  // Only a plain primary-button mouse press starts a drag. A right, middle, or (macOS) Ctrl press
  // would change the value and could open a context menu that swallows the `pointerup`.
  const isPrimaryPress = (e: PointerEvent) =>
    e.pointerType !== "mouse" || (e.button === 0 && !e.ctrlKey);

  const beginDrag = (e: PointerEvent<HTMLDivElement>, offset: number) => {
    grabOffset.current = offset;
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  const onBandPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!measured || !isPrimaryPress(e)) return;
    set(nearestValueIndexByPx(measured.layout.valuePx, pointerX(e)), "slider");
    beginDrag(e, 0);
    setNoRing(true);
    // So the arrow keys work at once.
    pressFocus.current = true;
    flagRef.current?.focus({ preventScroll: true });
    pressFocus.current = false;
  };

  const onFlagPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!measured || !isPrimaryPress(e)) return;
    beginDrag(e, pointerX(e) - measured.layout.valuePx[ui.timelineIndex]);
    setNoRing(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (grabOffset.current === null || !measured) return;
    set(nearestValueIndexByPx(measured.layout.valuePx, pointerX(e) - grabOffset.current), "slider");
  };

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    if (grabOffset.current === null) return;
    grabOffset.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const onFlagKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    setNoRing(false);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") step(1, "slider");
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") step(-1, "slider");
    else if (e.key === "Home") set(0, "slider");
    else if (e.key === "End") set(LAST, "slider");
    else return;
    e.preventDefault();
  };

  const dragHandlers = {
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
    onLostPointerCapture: onPointerEnd,
  };

  // Positions: measured pixels, or the design fractions until the first measurement.
  let handleLeft: string;
  let flagLeft: string;
  let rail: { left: string; width: string };
  let railTail: { left: string; width: string };
  if (measured) {
    const { layout, trackWidth, flagWidth } = measured;
    const center = layout.valuePx[index];
    const end = layout.inset + layout.span;
    handleLeft = `${center}px`;
    flagLeft = `${Math.max(0, Math.min(trackWidth - flagWidth, center - flagWidth / 2))}px`;
    rail = {
      left: `${layout.inset}px`,
      width: `${Math.max(0, layout.railSplit - layout.inset)}px`,
    };
    railTail = {
      left: `${layout.railSplit}px`,
      width: `${Math.max(0, end - layout.railSplit)}px`,
    };
  } else {
    const at = DESIGN_VALUE_AT[index];
    handleLeft = pct(at);
    flagLeft = `clamp(0px, calc(${pct(at)} - ${FLAG_WIDTH / 2}px), calc(100% - ${FLAG_WIDTH}px))`;
    rail = { left: "0", width: pct(ZERO_AT) };
    railTail = { left: pct(ZERO_AT), width: pct(1 - ZERO_AT) };
  }

  return (
    <div className="collapse-timeline">
      <div ref={tlRef} className={`collapse-tl${dragging ? " dragging" : ""}`}>
        <div className="collapse-tl-rail" style={rail} />
        <div className="collapse-tl-rail-tail" style={railTail} />
        <ol ref={rowRef} className="collapse-tl-row" aria-label="Timeline landmarks">
          {TIMELINE_STOPS.map((stop, i) => {
            const Art = stop.art;
            const className = ["collapse-tl-stop", stop.end && "hollow", stop.years === 0 && "zero"]
              .filter(Boolean)
              .join(" ");
            const left = measured ? `${measured.layout.dotPx[i]}px` : pct(stop.at);
            // The spaces between the spans are not drawn (the stop is a flex column) but keep the
            // lines apart when the item is read as text.
            return (
              <li key={stop.years ?? "now"} className={className} style={{ left }}>
                <span className={`collapse-tl-ico${Art ? " art" : ""}`} aria-hidden="true">
                  {Art && <Art />}
                </span>
                <span className="collapse-tl-dot" aria-hidden="true" />
                {stop.years === null && <span className="sr-only">current year</span>}{" "}
                <span className="collapse-tl-yr">{stop.yearLabel ?? String(currentYear())}</span>
                {stop.years === 0 && (
                  <>
                    {" "}
                    <span className="sr-only">(the collapse)</span>
                  </>
                )}
                {stop.eventLines.map((line) => (
                  <Fragment key={line}>
                    {" "}
                    <span className="collapse-tl-ev">{line}</span>
                  </Fragment>
                ))}
              </li>
            );
          })}
        </ol>
        <div className="collapse-tl-handle" aria-hidden="true" style={{ left: handleLeft }}>
          <span className="collapse-tl-stem" />
          <span className="collapse-tl-ring" />
        </div>
        <div
          ref={flagRef}
          className={`collapse-tl-flag${noRing ? " no-ring" : ""}`}
          role="slider"
          tabIndex={0}
          aria-label="Years before collapse"
          aria-valuemin={0}
          aria-valuemax={TIMELINE_VALUES[0]}
          aria-valuenow={years}
          aria-valuetext={`${formatYears(years)} years before collapse`}
          style={{ left: flagLeft }}
          onKeyDown={onFlagKeyDown}
          onFocus={() => {
            if (!pressFocus.current) setNoRing(false);
          }}
          onBlur={() => setNoRing(false)}
          onPointerDown={onFlagPointerDown}
          {...dragHandlers}
        >
          <span>
            <b>Sampling:</b> {formatYears(years)}
          </span>
          <span>years before collapse</span>
        </div>
        <div
          className="collapse-tl-hit"
          aria-hidden="true"
          onPointerDown={onBandPointerDown}
          {...dragHandlers}
        />
      </div>
    </div>
  );
});
