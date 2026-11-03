import { act, fireEvent, render, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock only `useLogEvent` and `useAnnounce`, keeping the real shared exports. `vi.hoisted` so the
// spies exist when `vi.mock` runs.
const { logEvent, announce } = vi.hoisted(() => ({ logEvent: vi.fn(), announce: vi.fn() }));
vi.mock("@concord-consortium/mass-sims-shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@concord-consortium/mass-sims-shared")>()),
  useLogEvent: () => logEvent,
  useAnnounce: () => announce,
}));

import { TIMELINE_VALUES } from "../../model/timeline";
import {
  createRootStore,
  type RootStoreInstance,
  RootStoreProvider,
} from "../../stores/root-store";
import { CompareTrials } from "./compare-trials";

/** Takes a sample in `letter` at `years`, in the store directly. */
function sample(store: RootStoreInstance, letter: string, years: number) {
  act(() => {
    store.ui.selectTrial(letter);
    store.ui.setTimelineIndex(TIMELINE_VALUES.indexOf(years));
    store.takeSample();
  });
}

function setup(seed: (store: RootStoreInstance) => void = () => {}) {
  const store = createRootStore({ rng: () => 0.5 });
  seed(store);
  act(() => store.ui.openCompare(store.selectedSample?.years ?? null));
  const view = render(
    <RootStoreProvider store={store}>
      <CompareTrials />
    </RootStoreProvider>,
  );
  return { store, view };
}

/** Trial `letter`'s table, found by its caption. */
function table(view: ReturnType<typeof render>, letter: string) {
  return view.getByRole("table", { name: new RegExp(`^Trial ${letter},`) });
}

function rows(view: ReturnType<typeof render>, letter: string) {
  return Array.from(table(view, letter).querySelectorAll<HTMLElement>(".collapse-rows tr"));
}

beforeEach(() => {
  logEvent.mockClear();
  announce.mockClear();
});

describe("CompareTrials columns — empty", () => {
  it("shows four tables in A–D order, one prompt, and no average rows", () => {
    const { view } = setup();
    const captions = view.getAllByRole("table").map((t) => t.querySelector("caption")?.textContent);
    expect(captions).toEqual([
      "Trial A, Limestone, Dry, under 10 rainy days a year: no samples yet",
      "Trial B, Limestone, Wet, more than 50 rainy days a year: no samples yet",
      "Trial C, Granite, Dry, under 10 rainy days a year: no samples yet",
      "Trial D, Granite, Wet, more than 50 rainy days a year: no samples yet",
    ]);
    expect(view.container.querySelector(".collapse-compare-grid")).toHaveClass("all-empty");
    expect(view.container.querySelector(".collapse-prompt-pill")).toHaveTextContent(
      "Take samples in each trial, then compare them here",
    );
    expect(view.container.querySelector("tfoot")).toBeNull();
  });

  it("names each sort heading by its full column name", () => {
    const { view } = setup();
    for (const [name, word] of [
      ["Years before collapse (yr)", "Years"],
      ["Erosion rate (mm/1,000 yr)", "Rate"],
      ["Rock above cave (mm)", "Rock"],
    ]) {
      const buttons = view.getAllByRole("button", { name });
      expect(buttons).toHaveLength(4);
      for (const button of buttons) expect(button).toHaveTextContent(new RegExp(`^${word}$`));
    }
  });
});

describe("CompareTrials columns — with samples", () => {
  const seed = (store: RootStoreInstance) => {
    sample(store, "A", 50000);
    sample(store, "A", 200000);
    sample(store, "B", 0);
  };

  it("shows each trial's own rows, its averages, and the notice in an empty trial", () => {
    const { view } = setup(seed);
    expect(view.container.querySelector(".collapse-compare-grid")).not.toHaveClass("all-empty");
    expect(view.container.querySelector(".collapse-prompt-pill")).toBeNull();
    expect(rows(view, "A").map((r) => r.getAttribute("aria-label"))).toEqual([
      "Trial A, 50,000 years before collapse, erosion rate 20 mm per 1,000 years, " +
        "rock above cave 5,800 mm",
      "Trial A, 200,000 years before collapse, erosion rate 20 mm per 1,000 years, " +
        "rock above cave 8,800 mm",
    ]);
    const averages = table(view, "A").querySelector("tfoot tr") as HTMLTableRowElement;
    expect(averages.cells).toHaveLength(3);
    expect(averages.cells[0]).toHaveAttribute("colspan", "2");
    expect(averages).toHaveTextContent("Average:207,300");
    expect(table(view, "A").querySelector("caption")).toHaveTextContent(/: 2 samples$/);
    expect(
      within(table(view, "C").closest(".collapse-compare-rows") as HTMLElement).getByText(
        "No samples taken yet",
      ),
    ).toBeInTheDocument();
    expect(rows(view, "C")).toHaveLength(0);
  });

  it("shows 0 rock for a collapsed sample and marks it in its label", () => {
    const { view } = setup(seed);
    const [row] = rows(view, "B");
    expect(row.getAttribute("aria-label")).toMatch(
      /^Trial B, 0 years .*, rock above cave 0 mm, collapsed$/,
    );
    expect(row.querySelectorAll("td")[3].innerHTML).toBe("0");
  });

  it("draws the hidden thumbnail stand-in in each row", () => {
    const { view } = setup(seed);
    const all = ["A", "B"].flatMap((letter) => rows(view, letter));
    expect(all).toHaveLength(3);
    for (const row of all) {
      expect(row.querySelector(".cmp-pic .collapse-pic-standin")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    }
  });

  it("sorts every column, and the data table's sort, from any heading", () => {
    const { store, view } = setup(seed);
    const [, rateInB] = view.getAllByRole("button", { name: "Erosion rate (mm/1,000 yr)" });
    fireEvent.click(rateInB);
    expect(store.ui.sort).toEqual({ key: "rate", direction: 1 });
    for (const button of view.getAllByRole("button", { name: "Erosion rate (mm/1,000 yr)" })) {
      expect(button.closest("th")).toHaveAttribute("aria-sort", "ascending");
    }
    expect(logEvent).toHaveBeenCalledWith("table_sorted", {
      trial: "B",
      key: "rate",
      direction: "ascending",
      view: "compare",
    });
    fireEvent.click(view.getAllByRole("button", { name: "Years before collapse (yr)" })[0]);
    expect(rows(view, "A").map((r) => r.dataset.year)).toEqual(["50000", "200000"]);
    fireEvent.click(view.getAllByRole("button", { name: "Years before collapse (yr)" })[0]);
    expect(rows(view, "A").map((r) => r.dataset.year)).toEqual(["200000", "50000"]);
  });
});

describe("CompareTrials columns — linking and pinning", () => {
  const seed = (store: RootStoreInstance) => {
    sample(store, "A", 0);
    sample(store, "A", 50000);
    sample(store, "B", 0);
    sample(store, "C", 100000);
  };
  const linked = (view: ReturnType<typeof render>) =>
    Array.from(view.container.querySelectorAll<HTMLElement>("tr[data-linked]")).map(
      (r) => r.dataset.rowKey,
    );
  const pinned = (view: ReturnType<typeof render>) =>
    Array.from(view.container.querySelectorAll<HTMLElement>('tr[aria-current="true"]')).map(
      (r) => r.dataset.rowKey,
    );

  it("hovering a row links every row with the same year, in every column", () => {
    const { view } = setup(seed);
    fireEvent.mouseEnter(rows(view, "B")[0]);
    expect(linked(view)).toEqual(["A:1", "B:1"]);
    fireEvent.mouseLeave(rows(view, "B")[0]);
    expect(linked(view)).toEqual([]);
  });

  it("pressing a row pins its year everywhere and announces; pressing again clears it", () => {
    const { store, view } = setup(seed);
    // Opening pins the selected row's year: C's last sample, at 100,000.
    expect(pinned(view)).toEqual(["C:1"]);
    fireEvent.click(rows(view, "A")[0]);
    expect(store.ui.pinnedYear).toBe(0);
    expect(pinned(view)).toEqual(["A:1", "B:1"]);
    expect(announce).toHaveBeenLastCalledWith(
      "0 years before collapse pinned. Sampled in trials A, B; not in C, D.",
    );
    fireEvent.click(rows(view, "B")[0]);
    expect(pinned(view)).toEqual([]);
    expect(announce).toHaveBeenLastCalledWith("Pin cleared.");
  });

  it("Enter and Space on a row pin its year", () => {
    const { store, view } = setup(seed);
    fireEvent.keyDown(rows(view, "A")[1], { key: "Enter" });
    expect(store.ui.pinnedYear).toBe(50000);
    fireEvent.keyDown(rows(view, "A")[1], { key: " " });
    expect(store.ui.pinnedYear).toBeNull();
  });
});
