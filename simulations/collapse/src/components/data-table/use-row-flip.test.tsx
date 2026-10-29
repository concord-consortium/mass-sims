import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { logEvent } = vi.hoisted(() => ({ logEvent: vi.fn() }));
vi.mock("@concord-consortium/mass-sims-shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@concord-consortium/mass-sims-shared")>()),
  useLogEvent: () => logEvent,
}));

import { Announcer } from "@concord-consortium/mass-sims-shared";
import { TIMELINE_VALUES } from "../../model/timeline";
import { createRootStore, RootStoreProvider } from "../../stores/root-store";
import { DataTable } from "./data-table";
import { flipDeltas } from "./use-row-flip";

describe("flipDeltas", () => {
  it("gives each moved row its offset back to its old seat", () => {
    const before = new Map([
      ["A:1", 0],
      ["A:2", 48],
      ["A:3", 96],
    ]);
    const after = new Map([
      ["A:3", 0],
      ["A:2", 48],
      ["A:1", 96],
    ]);
    expect(flipDeltas(before, after)).toEqual([
      { id: "A:3", dy: 96 },
      { id: "A:1", dy: -96 },
    ]);
  });

  it("leaves out new rows and rows that did not move", () => {
    const before = new Map([["A:1", 0]]);
    const after = new Map([
      ["A:1", 0],
      ["A:2", 48],
    ]);
    expect(flipDeltas(before, after)).toEqual([]);
  });
});

describe("useRowFlip in the table", () => {
  const originalMatchMedia = window.matchMedia;
  /** The slides started by one change: each row's starting offset, by key. */
  let slides: Record<string, number>;
  /** Each row's slide still running: how far it is shown from its seat. */
  let running: Map<Element, number>;
  /** A stand-in `Animation` for a row's slide; cancelling it ends the slide. */
  const slideOf = (el: Element) =>
    ({
      cancel: () => {
        running.delete(el);
      },
    }) as unknown as Animation;

  beforeEach(() => {
    slides = {};
    running = new Map();
    // jsdom has no layout: put each row at 48px × its position in its section, moved by any slide
    // still running.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      const top =
        this.tagName === "TR" && this.parentElement
          ? Array.from(this.parentElement.children).indexOf(this) * 48 + (running.get(this) ?? 0)
          : 0;
      return { top, bottom: top + 48, left: 0, right: 0, width: 0, height: 48 } as DOMRect;
    });
    vi.spyOn(Element.prototype, "animate").mockImplementation(function (this: Element, keyframes) {
      const from = (keyframes as Keyframe[])[0].transform as string;
      const dy = Number(/translateY\((-?[\d.]+)px\)/.exec(from)?.[1]);
      slides[(this as HTMLElement).dataset.rowKey ?? ""] = dy;
      running.set(this, dy);
      return slideOf(this);
    });
    vi.spyOn(Element.prototype, "getAnimations").mockImplementation(function (this: Element) {
      return running.has(this) ? [slideOf(this)] : [];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.matchMedia = originalMatchMedia;
    // @ts-expect-error jsdom has no scrollIntoView; remove any stub a test added.
    delete HTMLElement.prototype.scrollIntoView;
  });

  /** Records each row that is scrolled into view smoothly (the reveal), by its key. */
  function stubScroll(): string[] {
    const scrolled: string[] = [];
    HTMLElement.prototype.scrollIntoView = vi.fn(function (this: HTMLElement, arg) {
      if (typeof arg === "object" && arg?.behavior) scrolled.push(this.dataset.rowKey ?? "");
    });
    return scrolled;
  }

  function setup() {
    const store = createRootStore({ rng: () => 0.5 });
    const view = render(
      <RootStoreProvider store={store}>
        <Announcer>
          <DataTable />
        </Announcer>
      </RootStoreProvider>,
    );
    const take = (years: number) =>
      act(() => {
        store.ui.setTimelineIndex(TIMELINE_VALUES.indexOf(years));
        store.takeSample();
      });
    const row = (key: string) =>
      view.container.querySelector<HTMLElement>(`tr[data-row-key="${key}"]`) as HTMLElement;
    /** Lets every running slide finish, and forgets the slides started so far. */
    const settle = () => {
      running.clear();
      slides = {};
    };
    return { store, view, take, row, settle };
  }

  it("slides the rows that moved on a sort from their old seats", () => {
    const { view, take, settle } = setup();
    take(100000);
    take(0);
    take(200000);
    settle();
    fireEvent.click(view.getByRole("button", { name: "Years before collapse" }));
    // Displayed 100,000 / 0 / 200,000 → 0 / 100,000 / 200,000: A:1 and A:2 swap seats.
    expect(slides).toEqual({ "A:2": 48, "A:1": -48 });
  });

  it("carries an interrupted slide on from where the row is shown, and saves clean seats", () => {
    const { view, take, row, settle } = setup();
    take(100000);
    take(0);
    take(200000);
    settle();
    const years = view.getByRole("button", { name: "Years before collapse" });
    // Ascending: A:2 / A:1 / A:3. Halfway through, A:2 is shown 24px below its seat and A:1 24px
    // above.
    fireEvent.click(years);
    running.set(row("A:2"), 24);
    running.set(row("A:1"), -24);
    slides = {};
    // Descending: A:3 / A:1 / A:2. Each slide starts where the row is shown: A:2 at 0 + 24,
    // A:1 at 48 − 24, A:3 at 96.
    fireEvent.click(years);
    expect(slides).toEqual({ "A:3": 96, "A:1": -24, "A:2": -72 });
    // Unsorted: A:1 / A:2 / A:3. Measured from the clean seats, not from the shown ones.
    settle();
    fireEvent.click(years);
    expect(slides).toEqual({ "A:1": 48, "A:2": 48, "A:3": -96 });
  });

  it("slides the rows below a deleted one up into its seat", () => {
    const { view, take, settle } = setup();
    take(200000);
    take(100000);
    take(0);
    settle();
    fireEvent.click(
      view.getByRole("button", { name: "Delete the sample at 200,000 years before collapse" }),
    );
    expect(slides).toEqual({ "A:2": 48, "A:3": 48 });
  });

  it("neither animates nor scrolls on a switch to a trial with one row", () => {
    // From an empty trial, A's one row would otherwise look like a just-taken sample.
    const scrolled = stubScroll();
    const { store, take, settle } = setup();
    take(200000);
    act(() => store.ui.selectTrial("B"));
    scrolled.length = 0;
    settle();
    act(() => store.ui.selectTrial("A"));
    expect(scrolled).toEqual([]);
    expect(slides).toEqual({});
  });

  it("does not slide rows under reduced motion", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof matchMedia;
    const { view, take, settle } = setup();
    take(100000);
    take(0);
    settle();
    fireEvent.click(view.getByRole("button", { name: "Years before collapse" }));
    expect(slides).toEqual({});
  });

  it("scrolls a new sample into view, and only on a new sample", () => {
    const scrolled = stubScroll();
    const { view, take } = setup();
    take(200000);
    take(0);
    expect(scrolled).toEqual(["A:1", "A:2"]);
    // Sorting, selecting, and deleting never scroll.
    fireEvent.click(view.getByRole("button", { name: "Years before collapse" }));
    fireEvent.click(view.getAllByRole("row")[1]);
    fireEvent.click(
      view.getByRole("button", { name: "Delete the sample at 0 years before collapse" }),
    );
    expect(scrolled).toEqual(["A:1", "A:2"]);
  });
});
