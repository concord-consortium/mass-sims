import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock `useLogEvent`, `useAnnounce` and `smoothScrollIntoView`, keeping the real shared exports.
// `vi.hoisted` so the spies exist when `vi.mock` runs.
const { smoothScrollIntoView } = vi.hoisted(() => ({ smoothScrollIntoView: vi.fn() }));
vi.mock("@concord-consortium/mass-sims-shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@concord-consortium/mass-sims-shared")>()),
  useLogEvent: () => vi.fn(),
  useAnnounce: () => vi.fn(),
  smoothScrollIntoView,
}));

import { TIMELINE_VALUES } from "../../model/timeline";
import {
  createRootStore,
  type RootStoreInstance,
  RootStoreProvider,
} from "../../stores/root-store";
import { CompareTrials } from "./compare-trials";

/** Takes samples in `letter` at each of `years`, in the store directly. */
function sample(store: RootStoreInstance, letter: string, ...years: number[]) {
  store.ui.selectTrial(letter);
  for (const y of years) {
    store.ui.setTimelineIndex(TIMELINE_VALUES.indexOf(y));
    store.takeSample();
  }
}

// A: three rows, B: one, C: none, D: three.
function setup() {
  const store = createRootStore({ rng: () => 0.5 });
  sample(store, "A", 200000, 100000, 0);
  sample(store, "B", 100000);
  sample(store, "D", 200000, 50000, 0);
  store.ui.selectTrial("C");
  store.openCompare();
  const view = render(
    <RootStoreProvider store={store}>
      <CompareTrials />
    </RootStoreProvider>,
  );
  return { store, view };
}

function column(view: ReturnType<typeof render>, i: number) {
  return view.container.querySelectorAll<HTMLElement>(".collapse-compare-col")[i];
}
function rows(view: ReturnType<typeof render>, i: number) {
  return Array.from(column(view, i).querySelectorAll<HTMLElement>("tbody.collapse-rows > tr"));
}
function headings(view: ReturnType<typeof render>, i: number) {
  return Array.from(column(view, i).querySelectorAll<HTMLElement>(".collapse-th-sort"));
}
/** The rows highlighted as the linked year, by row key. */
function linked(view: ReturnType<typeof render>) {
  return Array.from(view.container.querySelectorAll<HTMLElement>("tr[data-linked]")).map(
    (r) => r.dataset.rowKey,
  );
}
function press(el: HTMLElement, key: string) {
  fireEvent.keyDown(el, { key });
}

beforeEach(() => smoothScrollIntoView.mockClear());

describe("useCompareKeyboardNav", () => {
  it("gives each column one tab stop in its rows: the first row", () => {
    const { view } = setup();
    expect(rows(view, 0).map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    expect(rows(view, 1).map((r) => r.tabIndex)).toEqual([0]);
  });

  it("ArrowDown / ArrowUp / End / Home move within a column, with the keyboard ring", () => {
    const { view } = setup();
    const [a0, a1, a2] = rows(view, 0);
    a0.focus();
    press(a0, "ArrowDown");
    expect(document.activeElement).toBe(a1);
    expect(a1).toHaveClass("kb-focus");
    press(a1, "End");
    expect(document.activeElement).toBe(a2);
    press(a2, "ArrowUp");
    expect(document.activeElement).toBe(a1);
    press(a1, "Home");
    expect(document.activeElement).toBe(a0);
    expect(a1).not.toHaveClass("kb-focus");
  });

  it("ArrowUp from the first row goes to the heading the student came down through", () => {
    const { view } = setup();
    const [, rate] = headings(view, 0);
    rate.focus();
    press(rate, "ArrowDown");
    expect(document.activeElement).toBe(rows(view, 0)[0]);
    press(rows(view, 0)[0], "ArrowUp");
    expect(document.activeElement).toBe(rate);
  });

  it("ArrowUp from a first row reached another way goes to the column's first heading", () => {
    const { view } = setup();
    const [d0] = rows(view, 3);
    d0.focus();
    press(d0, "ArrowUp");
    expect(document.activeElement).toBe(headings(view, 3)[0]);
  });

  it("ArrowRight / ArrowLeft move straight across, skip empty columns, and keep the row position", () => {
    const { view } = setup();
    const a2 = rows(view, 0)[2];
    a2.focus();
    press(a2, "ArrowRight");
    // B has one row, so the third position clamps to it.
    expect(document.activeElement).toBe(rows(view, 1)[0]);
    press(rows(view, 1)[0], "ArrowRight");
    // C has no rows; D's third row, because the goal is still the third.
    expect(document.activeElement).toBe(rows(view, 3)[2]);
    press(rows(view, 3)[2], "ArrowLeft");
    expect(document.activeElement).toBe(rows(view, 1)[0]);
    press(rows(view, 1)[0], "ArrowLeft");
    expect(document.activeElement).toBe(rows(view, 0)[2]);
  });

  it("on a heading, ArrowLeft / ArrowRight move through all twelve and ArrowDown enters the rows", () => {
    const { view } = setup();
    const [years] = headings(view, 0);
    years.focus();
    for (let i = 0; i < 3; i++) press(document.activeElement as HTMLElement, "ArrowRight");
    expect(document.activeElement).toBe(headings(view, 1)[0]);
    press(headings(view, 1)[0], "ArrowDown");
    expect(document.activeElement).toBe(rows(view, 1)[0]);
  });

  it("a row focused with the keyboard links its year in every column, and leaving the rows unlinks it", () => {
    const { view } = setup();
    const a1 = rows(view, 0)[1];
    fireEvent.keyDown(document, { key: "Tab" });
    act(() => a1.focus());
    expect(linked(view)).toEqual(["A:2", "B:1"]);
    act(() => headings(view, 0)[0].focus());
    expect(linked(view)).toEqual([]);
  });

  it("the focused row's year is linked again after the pointer passes over another row", () => {
    const { view } = setup();
    const a1 = rows(view, 0)[1];
    fireEvent.keyDown(document, { key: "Tab" });
    act(() => a1.focus());
    const d0 = rows(view, 3)[0];
    fireEvent.mouseEnter(d0);
    expect(linked(view)).toEqual(["A:1", "D:1"]);
    fireEvent.mouseLeave(d0);
    expect(linked(view)).toEqual(["A:2", "B:1"]);
  });

  it("a click draws no keyboard ring, and leaves no link once the pointer leaves the row", () => {
    const { view } = setup();
    const a1 = rows(view, 0)[1];
    fireEvent.mouseEnter(a1);
    fireEvent.pointerDown(a1);
    act(() => a1.focus());
    expect(a1).not.toHaveClass("kb-focus");
    fireEvent.mouseLeave(a1);
    expect(linked(view)).toEqual([]);
  });

  it("on a row that keeps its focus, a press unlinks its year and a key links it again", () => {
    const { view } = setup();
    const a2 = rows(view, 0)[2];
    fireEvent.keyDown(document, { key: "Tab" });
    act(() => a2.focus());
    expect(linked(view)).toEqual(["A:3", "D:3"]);
    fireEvent.pointerDown(a2);
    expect(linked(view)).toEqual([]);
    // The last row, so ArrowDown does not move focus.
    press(a2, "ArrowDown");
    expect(document.activeElement).toBe(a2);
    expect(linked(view)).toEqual(["A:3", "D:3"]);
  });
});

describe("CompareColumn pin reveal", () => {
  it("scrolls each column's topmost row with the pinned year into view, on a pin", () => {
    const store = createRootStore({ rng: () => 0.5 });
    // A has two rows at 0. Sorted by rate, the later one (A:2) is on top.
    store.trials.get("A")?.addSample({ years: 0, rate: 30, roof: 2800 });
    store.trials.get("A")?.addSample({ years: 0, rate: 10, roof: 3000 });
    sample(store, "D", 0);
    store.ui.selectTrial("C");
    store.ui.cycleSort("rate");
    store.openCompare();
    render(
      <RootStoreProvider store={store}>
        <CompareTrials />
      </RootStoreProvider>,
    );
    // C was selected with no row, so nothing is pinned on opening.
    expect(smoothScrollIntoView).not.toHaveBeenCalled();
    act(() => store.ui.togglePin(0));
    expect(smoothScrollIntoView.mock.calls.map(([row]) => row.dataset.rowKey)).toEqual([
      "A:2",
      "D:1",
    ]);
  });

  it("reveals the year carried in on opening", () => {
    const store = createRootStore({ rng: () => 0.5 });
    sample(store, "A", 200000, 100000);
    store.openCompare();
    render(
      <RootStoreProvider store={store}>
        <CompareTrials />
      </RootStoreProvider>,
    );
    expect(smoothScrollIntoView.mock.calls.map(([row]) => row.dataset.rowKey)).toEqual(["A:2"]);
  });
});

describe("CompareColumn row animation", () => {
  afterEach(() => vi.restoreAllMocks());

  it("slides each column's moved rows to their new seats on a sort", () => {
    const slid: string[] = [];
    // jsdom has no layout: put each row at 36px × its position in its section.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      const top =
        this.tagName === "TR" && this.parentElement
          ? Array.from(this.parentElement.children).indexOf(this) * 36
          : 0;
      return { top, bottom: top + 36, left: 0, right: 0, width: 0, height: 36 } as DOMRect;
    });
    vi.spyOn(Element.prototype, "getAnimations").mockReturnValue([]);
    vi.spyOn(Element.prototype, "animate").mockImplementation(function (this: Element) {
      slid.push((this as HTMLElement).dataset.rowKey ?? "");
      return { cancel: () => {} } as unknown as Animation;
    });
    const { store } = setup();
    act(() => store.ui.cycleSort("years"));
    // Ascending reverses A and D (sampled 200,000 first); B's one row does not move.
    expect(slid.sort()).toEqual(["A:1", "A:3", "D:1", "D:3"]);
  });
});
