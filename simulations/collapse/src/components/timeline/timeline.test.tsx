import { act, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock only `useLogEvent`, keeping the real shared exports. `vi.hoisted` so the spy exists when
// `vi.mock` runs.
const { logEvent } = vi.hoisted(() => ({ logEvent: vi.fn() }));
vi.mock("@concord-consortium/mass-sims-shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@concord-consortium/mass-sims-shared")>()),
  useLogEvent: () => logEvent,
}));

// jsdom does not lay out text, so each label line gets a fixed width.
vi.mock("./measure-line-widths", () => ({
  measureLineWidths: (stop: HTMLElement) =>
    Array.from(stop.querySelectorAll(".collapse-tl-yr, .collapse-tl-ev"), () => 60),
}));

import {
  currentYear,
  TIMELINE_SEGMENTS,
  TIMELINE_STOPS,
  TIMELINE_VALUES,
} from "../../model/timeline";
import { layoutTimeline, nearestValueIndexByPx } from "../../model/timeline-layout";
import { createRootStore, RootStoreProvider } from "../../stores/root-store";
import { Timeline } from "./timeline";

const ROW_WIDTH = 800;
/** The flag's design width; jsdom's `offsetWidth` is 0, so the component falls back to it. */
const FLAG_WIDTH = 158;
const LAST = TIMELINE_VALUES.length - 1;

// The layout the component computes from the mocked widths, so a test can aim at a value's x.
const LAYOUT = layoutTimeline({
  rowWidth: ROW_WIDTH,
  stopLineWidths: TIMELINE_STOPS.map((s) => Array(s.eventLines.length + 1).fill(60)),
  stops: TIMELINE_STOPS,
  segments: TIMELINE_SEGMENTS,
});

let clientWidth: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logEvent.mockClear();
  // jsdom reports every width as 0; the timeline skips layout until its row has a width.
  clientWidth = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(ROW_WIDTH);
});

afterEach(() => {
  clientWidth.mockRestore();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// jsdom has no `PointerEvent`, so `fireEvent.pointerDown` would drop `clientX`. A `MouseEvent` with
// the pointer event's name carries it, and React handles it as that pointer event.
function pointer(
  el: Element,
  type: string,
  clientX: number,
  mouse?: { button?: number; ctrlKey?: boolean },
  pointerId?: number,
) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, ...mouse });
  // `MouseEvent` has no `pointerType` or `pointerId`; set them when a test needs them.
  if (mouse) Object.defineProperty(event, "pointerType", { value: "mouse" });
  if (pointerId !== undefined) Object.defineProperty(event, "pointerId", { value: pointerId });
  fireEvent(el, event);
}

function setup() {
  const store = createRootStore();
  const view = render(
    <RootStoreProvider store={store}>
      <Timeline />
    </RootStoreProvider>,
  );
  const slider = view.getByRole("slider", { name: "Years before collapse" });
  const band = view.container.querySelector(".collapse-tl-hit") as HTMLElement;
  return { store, view, slider, band };
}

describe("Timeline", () => {
  it("renders the landmarks as a readable list in order", () => {
    const { view } = setup();
    const list = view.getByRole("list", { name: "Timeline landmarks" });
    // Explicit, because Safari drops list semantics from a list styled with `list-style: none`.
    expect(list).toHaveAttribute("role", "list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(7);
    expect(items[0]).toHaveTextContent("200,000 yr Modern humans appear in Africa");
    expect(items[3]).toHaveTextContent("4,600 yr Pyramids are built");
    expect(items[5]).toHaveTextContent("0 yr (the collapse) Cave roof collapses");
  });

  it("gives the slider its value, range, and name", () => {
    const { slider } = setup();
    expect(slider).toHaveAttribute("tabindex", "0");
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "200000");
    expect(slider).toHaveAttribute("aria-valuenow", "200000");
    expect(slider).toHaveAttribute("aria-valuetext", "200,000 years before collapse");
    expect(slider).toHaveTextContent("Sampling: 200,000");
  });

  it("places the stops, rails, handle, and flag from the measured layout", () => {
    const { view, store, slider } = setup();
    const el = (selector: string) => view.container.querySelector(selector) as HTMLElement;
    const stops = Array.from(view.container.querySelectorAll<HTMLElement>(".collapse-tl-stop"));
    stops.forEach((stop, i) => {
      expect(stop.style.left).toBe(`${LAYOUT.dotPx[i]}px`);
    });
    // Solid from the first dot to the 0 dot, dashed from there to the end marker.
    expect(el(".collapse-tl-rail").style.left).toBe(`${LAYOUT.inset}px`);
    expect(el(".collapse-tl-rail").style.width).toBe(`${LAYOUT.railSplit - LAYOUT.inset}px`);
    expect(el(".collapse-tl-rail-tail").style.left).toBe(`${LAYOUT.railSplit}px`);
    expect(el(".collapse-tl-rail-tail").style.width).toBe(
      `${LAYOUT.inset + LAYOUT.span - LAYOUT.railSplit}px`,
    );

    // The handle sits on the value; the flag is centered on it, but never leaves the track.
    const handle = el(".collapse-tl-handle");
    expect(handle.style.left).toBe(`${LAYOUT.valuePx[0]}px`);
    expect(LAYOUT.valuePx[0] - FLAG_WIDTH / 2).toBeLessThan(0);
    expect(slider.style.left).toBe("0px");

    act(() => store.ui.setTimelineIndex(8));
    const center = LAYOUT.valuePx[8];
    expect(center - FLAG_WIDTH / 2).toBeGreaterThan(0);
    expect(center + FLAG_WIDTH / 2).toBeLessThan(ROW_WIDTH);
    expect(handle.style.left).toBe(`${center}px`);
    expect(slider.style.left).toBe(`${center - FLAG_WIDTH / 2}px`);

    act(() => store.ui.setTimelineIndex(LAST));
    expect(LAYOUT.valuePx[LAST] + FLAG_WIDTH / 2).toBeGreaterThan(ROW_WIDTH);
    expect(slider.style.left).toBe(`${ROW_WIDTH - FLAG_WIDTH}px`);
  });

  it("lays the stops out again when the track or an end stop resizes", () => {
    // A stub that saves the callback and what it observes, so the test can trigger a resize.
    let onResize = () => {};
    const observed: Element[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          onResize = callback;
        }
        observe(el: Element) {
          observed.push(el);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    const { view } = setup();
    const stops = Array.from(view.container.querySelectorAll<HTMLElement>(".collapse-tl-stop"));
    expect(observed).toEqual([
      view.container.querySelector(".collapse-tl"),
      stops[0],
      stops[stops.length - 1],
    ]);
    expect(stops[3].style.left).toBe(`${LAYOUT.dotPx[3]}px`);

    const narrow = 600;
    clientWidth.mockReturnValue(narrow);
    act(() => onResize());
    const relaid = layoutTimeline({
      rowWidth: narrow,
      stopLineWidths: TIMELINE_STOPS.map((s) => Array(s.eventLines.length + 1).fill(60)),
      stops: TIMELINE_STOPS,
      segments: TIMELINE_SEGMENTS,
    });
    stops.forEach((stop, i) => {
      expect(stop.style.left).toBe(`${relaid.dotPx[i]}px`);
    });
    expect(relaid.dotPx[3]).not.toBeCloseTo(LAYOUT.dotPx[3]);
  });

  it("logs its changes with the slider as the source", () => {
    const { slider, band } = setup();
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(logEvent).toHaveBeenLastCalledWith(
      "sample_years_set",
      expect.objectContaining({ value: 150000, source: "slider" }),
    );
    pointer(band, "pointerdown", LAYOUT.valuePx[5]);
    pointer(band, "pointerup", 0);
    expect(logEvent).toHaveBeenLastCalledWith(
      "sample_years_set",
      expect.objectContaining({ value: 10000, source: "slider" }),
    );
    expect(logEvent).toHaveBeenCalledTimes(2);
  });

  it("logs a drag once, from its starting value, when it ends", () => {
    const { store, band } = setup();
    pointer(band, "pointerdown", LAYOUT.valuePx[3]);
    pointer(band, "pointermove", LAYOUT.valuePx[6]);
    pointer(band, "pointermove", LAYOUT.valuePx[9]);
    expect(store.ui.timelineIndex).toBe(9);
    expect(logEvent).not.toHaveBeenCalled();
    pointer(band, "pointerup", 0);
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith("sample_years_set", {
      value: TIMELINE_VALUES[9],
      previous: 200000,
      trial: "A",
      source: "slider",
    });
  });

  it("logs nothing for a drag that ends on its starting value", () => {
    const { slider, band } = setup();
    // A press on the flag that does not move it.
    pointer(slider, "pointerdown", LAYOUT.valuePx[0]);
    pointer(slider, "pointerup", 0);
    // A drag that leaves and comes back.
    pointer(band, "pointerdown", LAYOUT.valuePx[4]);
    pointer(band, "pointermove", LAYOUT.valuePx[0]);
    pointer(band, "pointercancel", 0);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("logs a drag that ends by cancel, or by a new press from the same pointer", () => {
    const { band } = setup();
    pointer(band, "pointerdown", LAYOUT.valuePx[2]);
    pointer(band, "pointercancel", 0);
    expect(logEvent).toHaveBeenLastCalledWith(
      "sample_years_set",
      expect.objectContaining({ value: TIMELINE_VALUES[2], previous: 200000 }),
    );
    pointer(band, "pointerdown", LAYOUT.valuePx[5], undefined, 1);
    // No `pointerup`: the same pointer presses again.
    pointer(band, "pointerdown", LAYOUT.valuePx[8], undefined, 1);
    expect(logEvent).toHaveBeenLastCalledWith(
      "sample_years_set",
      expect.objectContaining({ value: TIMELINE_VALUES[5], previous: TIMELINE_VALUES[2] }),
    );
    expect(logEvent).toHaveBeenCalledTimes(2);
  });

  it("steps one value per arrow key", () => {
    const { store, slider } = setup();
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(store.ui.timelineIndex).toBe(1);
    expect(slider).toHaveAttribute("aria-valuenow", "150000");
    expect(slider).toHaveAttribute("aria-valuetext", "150,000 years before collapse");
    fireEvent.keyDown(slider, { key: "ArrowDown" });
    expect(store.ui.timelineIndex).toBe(2);
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    fireEvent.keyDown(slider, { key: "ArrowUp" });
    expect(store.ui.timelineIndex).toBe(0);
  });

  it("jumps to the ends with Home and End", () => {
    const { store, slider } = setup();
    fireEvent.keyDown(slider, { key: "End" });
    expect(slider).toHaveAttribute("aria-valuenow", "0");
    expect(store.ui.sampleYears).toBe(0);
    fireEvent.keyDown(slider, { key: "Home" });
    expect(slider).toHaveAttribute("aria-valuenow", "200000");
  });

  it("ignores other keys", () => {
    const { store, slider } = setup();
    const notPrevented = fireEvent.keyDown(slider, { key: "PageDown" });
    expect(notPrevented).toBe(true);
    expect(store.ui.timelineIndex).toBe(0);
  });

  it("snaps to the nearest value when the timeline outside the flag is pressed, and follows the drag", () => {
    const { store, band, slider } = setup();
    const x = LAYOUT.valuePx[4] + 3;
    pointer(band, "pointerdown", x);
    expect(store.ui.timelineIndex).toBe(nearestValueIndexByPx(LAYOUT.valuePx, x));
    expect(store.ui.timelineIndex).toBe(4);
    expect(slider).toHaveFocus();
    pointer(band, "pointermove", LAYOUT.valuePx[9]);
    expect(store.ui.timelineIndex).toBe(9);
    pointer(band, "pointerup", 0);
    pointer(band, "pointermove", LAYOUT.valuePx[12]);
    expect(store.ui.timelineIndex).toBe(9);
  });

  it("does not change the value when the flag is pressed off center", () => {
    const { store, slider } = setup();
    act(() => store.ui.setTimelineIndex(8));
    const center = LAYOUT.valuePx[8];
    pointer(slider, "pointerdown", center + 70);
    expect(store.ui.timelineIndex).toBe(8);

    // Dragging keeps the grab offset: the handle (not the pointer) lands on the value under it.
    const target = LAYOUT.valuePx[10];
    pointer(slider, "pointermove", target + 70);
    expect(store.ui.timelineIndex).toBe(10);
    expect(nearestValueIndexByPx(LAYOUT.valuePx, target + 70)).not.toBe(10);
    pointer(slider, "pointerup", 0);
  });

  it("ignores right, middle, and Ctrl mouse presses", () => {
    const { view, store, band, slider } = setup();
    const track = view.container.querySelector(".collapse-tl") as HTMLElement;
    const x = LAYOUT.valuePx[6];
    for (const mouse of [{ button: 2 }, { button: 1 }, { button: 0, ctrlKey: true }]) {
      pointer(band, "pointerdown", x, mouse);
      pointer(slider, "pointerdown", x, mouse);
      pointer(band, "pointermove", LAYOUT.valuePx[9]);
      expect(store.ui.timelineIndex).toBe(0);
      expect(track).not.toHaveClass("dragging");
    }
    // A plain primary-button mouse press still works.
    pointer(band, "pointerdown", x, { button: 0 });
    expect(store.ui.timelineIndex).toBe(6);
  });

  it("ignores a second pointer while a drag is live", () => {
    const { view, store, band, slider } = setup();
    const track = view.container.querySelector(".collapse-tl") as HTMLElement;
    const first = 1;
    const second = 2;
    pointer(slider, "pointerdown", LAYOUT.valuePx[0], undefined, first);

    pointer(band, "pointerdown", LAYOUT.valuePx[6], undefined, second);
    pointer(band, "pointermove", LAYOUT.valuePx[9], undefined, second);
    expect(store.ui.timelineIndex).toBe(0);
    pointer(band, "pointerup", 0, undefined, second);
    expect(track).toHaveClass("dragging");

    pointer(slider, "pointermove", LAYOUT.valuePx[3], undefined, first);
    expect(store.ui.timelineIndex).toBe(3);
    pointer(slider, "pointerup", 0, undefined, first);
    expect(track).not.toHaveClass("dragging");
  });

  it("starts a new drag when the same pointer presses again", () => {
    const { store, band } = setup();
    pointer(band, "pointerdown", LAYOUT.valuePx[3], undefined, 1);
    // No `pointerup`: the old drag ended without an event.
    pointer(band, "pointerdown", LAYOUT.valuePx[7], undefined, 1);
    expect(store.ui.timelineIndex).toBe(7);
  });

  it("ends the drag when the pointer capture is lost", () => {
    const { view, store, band } = setup();
    const track = view.container.querySelector(".collapse-tl") as HTMLElement;
    pointer(band, "pointerdown", LAYOUT.valuePx[3]);
    expect(track).toHaveClass("dragging");
    pointer(band, "lostpointercapture", 0);
    expect(track).not.toHaveClass("dragging");
    pointer(band, "pointermove", LAYOUT.valuePx[9]);
    expect(store.ui.timelineIndex).toBe(3);
  });

  it("marks the track as dragging only while a drag is live", () => {
    const { view, slider } = setup();
    const track = view.container.querySelector(".collapse-tl") as HTMLElement;
    pointer(slider, "pointerdown", LAYOUT.valuePx[0]);
    expect(track).toHaveClass("dragging");
    pointer(slider, "pointercancel", 0);
    expect(track).not.toHaveClass("dragging");
  });

  it("hides the focus ring after a pointer press until the keyboard is used", () => {
    const { band, slider } = setup();
    pointer(band, "pointerdown", LAYOUT.valuePx[3]);
    pointer(band, "pointerup", 0);
    expect(slider).toHaveFocus();
    expect(slider).toHaveClass("no-ring");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider).not.toHaveClass("no-ring");

    pointer(slider, "pointerdown", LAYOUT.valuePx[4]);
    pointer(slider, "pointerup", 0);
    expect(slider).toHaveClass("no-ring");
    fireEvent.blur(slider);
    expect(slider).not.toHaveClass("no-ring");

    // A focus that a press did not cause (Tab) shows the ring.
    pointer(slider, "pointerdown", LAYOUT.valuePx[4]);
    expect(slider).toHaveClass("no-ring");
    fireEvent.focus(slider);
    expect(slider).not.toHaveClass("no-ring");
  });

  it("focuses the slider without the ring when the flag is pressed", () => {
    const { view, store, slider } = setup();
    const elsewhere = document.createElement("button");
    view.container.append(elsewhere);
    elsewhere.focus();
    pointer(slider, "pointerdown", LAYOUT.valuePx[0]);
    pointer(slider, "pointerup", 0);
    expect(slider).toHaveFocus();
    expect(slider).toHaveClass("no-ring");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(store.ui.timelineIndex).toBe(1);
  });

  it("shows the current calendar year on the end marker", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2031-06-15T12:00:00"));
    const { view } = setup();
    const items = view.getAllByRole("listitem");
    const end = items[items.length - 1];
    expect(end.querySelector(".collapse-tl-yr")?.textContent).toBe(String(currentYear()));
    expect(currentYear()).toBe(2031);
    expect(end).toHaveTextContent(/^current year 2031$/);
  });
});
