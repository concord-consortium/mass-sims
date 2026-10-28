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
  /** Each row's transform at the moment the old seats are flushed, per play. */
  let atFlush: Record<string, string>[];

  beforeEach(() => {
    atFlush = [];
    // jsdom has no layout: put each row at 48px × its position in its section.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      const top =
        this.tagName === "TR" && this.parentElement
          ? Array.from(this.parentElement.children).indexOf(this) * 48
          : 0;
      return { top, bottom: top + 48, left: 0, right: 0, width: 0, height: 48 } as DOMRect;
    });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.tagName === "TBODY") {
        const play: Record<string, string> = {};
        for (const tr of this.querySelectorAll<HTMLElement>("tr[data-row-key]")) {
          play[tr.dataset.rowKey as string] = tr.style.transform;
        }
        atFlush.push(play);
      }
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.matchMedia = originalMatchMedia;
  });

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
    return { store, view, take, row };
  }

  it("slides moved rows from their old seats on a sort, then clears the offset", () => {
    const { view, take, row } = setup();
    take(100000);
    take(0);
    take(200000);
    atFlush = [];
    fireEvent.click(view.getByRole("button", { name: "Years before collapse" }));
    // Displayed 100,000 / 0 / 200,000 → 0 / 100,000 / 200,000: A:1 and A:2 swap seats.
    expect(atFlush).toEqual([{ "A:2": "translateY(48px)", "A:1": "translateY(-48px)", "A:3": "" }]);
    expect(row("A:1").style.transform).toBe("");
    expect(row("A:1").style.transition).toBe("transform 240ms ease");
    expect(row("A:3").style.transition).toBe("");
  });

  it("slides the rows below a deleted one up into its seat", () => {
    const { view, take, row } = setup();
    take(200000);
    take(100000);
    take(0);
    atFlush = [];
    fireEvent.click(
      view.getByRole("button", { name: "Delete the sample at 200,000 years before collapse" }),
    );
    expect(atFlush).toEqual([{ "A:2": "translateY(48px)", "A:3": "translateY(48px)" }]);
    expect(row("A:2").style.transform).toBe("");
  });

  it("does not animate on a trial switch", () => {
    const { store, take, row } = setup();
    take(200000);
    act(() => store.ui.selectTrial("B"));
    take(200000);
    act(() => store.ui.selectTrial("A"));
    atFlush = [];
    act(() => store.ui.selectTrial("B"));
    expect(atFlush).toEqual([]);
    expect(row("B:1").style.transform).toBe("");
    expect(row("B:1").style.transition).toBe("");
  });

  it("does nothing under reduced motion", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof matchMedia;
    const { view, take, row } = setup();
    take(100000);
    take(0);
    atFlush = [];
    fireEvent.click(view.getByRole("button", { name: "Years before collapse" }));
    expect(atFlush).toEqual([]);
    expect(row("A:1").style.transition).toBe("");
  });

  it("scrolls a new sample into view, and only on a new sample", () => {
    const scrolled: string[] = [];
    HTMLElement.prototype.scrollIntoView = vi.fn(function (this: HTMLElement, arg) {
      if (typeof arg === "object" && arg?.behavior) scrolled.push(this.dataset.rowKey ?? "");
    });
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
    // @ts-expect-error jsdom has no scrollIntoView; remove the stub again.
    delete HTMLElement.prototype.scrollIntoView;
  });
});
