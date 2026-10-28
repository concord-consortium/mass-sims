import { act, fireEvent, render, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock only `useLogEvent`, keeping the real shared exports. `vi.hoisted` so the spy exists when
// `vi.mock` runs.
const { logEvent } = vi.hoisted(() => ({ logEvent: vi.fn() }));
vi.mock("@concord-consortium/mass-sims-shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@concord-consortium/mass-sims-shared")>()),
  useLogEvent: () => logEvent,
}));

import { Announcer } from "@concord-consortium/mass-sims-shared";
import { TIMELINE_VALUES } from "../../model/timeline";
import {
  createRootStore,
  type RootStoreInstance,
  RootStoreProvider,
} from "../../stores/root-store";
import { DataTable } from "./data-table";

/** A deterministic RNG (LCG), so sampled rates differ but repeat from run to run. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function setup() {
  const store = createRootStore({ rng: makeRng(1) });
  const view = render(
    <RootStoreProvider store={store}>
      <Announcer>
        <DataTable />
      </Announcer>
    </RootStoreProvider>,
  );
  return { store, view };
}

/** Takes a sample at `years` in the selected trial. */
function sample(store: RootStoreInstance, years: number) {
  let taken: ReturnType<RootStoreInstance["takeSample"]> | undefined;
  act(() => {
    store.ui.setTimelineIndex(TIMELINE_VALUES.indexOf(years));
    taken = store.takeSample();
  });
  if (!taken) throw new Error("no sample");
  return taken;
}

function bodyRows(view: ReturnType<typeof render>) {
  return Array.from(view.container.querySelectorAll<HTMLTableRowElement>(".collapse-rows tr"));
}

/** The years column of each displayed row, as shown. */
function displayedYears(view: ReturnType<typeof render>) {
  return bodyRows(view).map((tr) => tr.cells[1].textContent);
}

beforeEach(() => {
  logEvent.mockClear();
});

describe("DataTable — empty", () => {
  it("shows the prompt, no average row, and an empty caption", () => {
    const { view } = setup();
    expect(view.container.querySelector(".collapse-stage")).toBeInTheDocument();
    expect(view.container.querySelector(".collapse-prompt-pill")).toHaveTextContent(
      "Pick a year, then click Sample",
    );
    expect(view.container.querySelector("thead")).toHaveClass("has-prompt");
    expect(view.container.querySelector("tfoot")).toBeNull();
    expect(view.container.querySelector(".collapse-filler")).toBeNull();
    expect(view.container.querySelector("caption")).toHaveTextContent(
      "Samples for trial A: no rows yet.",
    );
    expect(bodyRows(view)).toHaveLength(0);
  });

  it("has one header row: three sort buttons and two named end columns", () => {
    const { view } = setup();
    expect(view.container.querySelectorAll("thead tr")).toHaveLength(1);
    const headers = view.getAllByRole("columnheader");
    expect(headers).toHaveLength(5);
    expect(headers[0]).toHaveTextContent("Cave");
    expect(headers[4]).toHaveTextContent("Delete row");
    for (const name of ["Years before collapse", "Erosion rate", "Rock above cave"]) {
      expect(view.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(headers[2]).toHaveTextContent("Erosion rate(mm/1,000 yr)");
  });
});

describe("DataTable — rows", () => {
  it("renders each sample with its label, the averages, and the new row selected", () => {
    const { store, view } = setup();
    const a = sample(store, 200000);
    const b = sample(store, 100000);
    const rows = bodyRows(view);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute(
      "aria-label",
      `Sample at 200,000 years before collapse, erosion rate ${Math.round(a.rate)} mm per 1,000 years, rock above cave 8,800 mm`,
    );
    expect(rows[1]).toHaveAttribute(
      "aria-label",
      `Sample at 100,000 years before collapse, erosion rate ${Math.round(b.rate)} mm per 1,000 years, rock above cave 6,800 mm`,
    );
    expect(rows[0]).not.toHaveAttribute("aria-current");
    expect(rows[1]).toHaveAttribute("aria-current", "true");
    expect(rows[1]).toHaveClass("is-selected");

    // The spacer that holds the average row at the bottom: hidden, and between the rows and it.
    const filler = view.container.querySelector(".collapse-filler");
    expect(filler).toHaveAttribute("aria-hidden", "true");
    expect(filler?.previousElementSibling).toHaveClass("collapse-rows");
    expect(filler?.nextElementSibling?.tagName).toBe("TFOOT");

    const foot = view.container.querySelector("tfoot .collapse-foot") as HTMLElement;
    expect(within(foot).getByRole("rowheader")).toHaveTextContent("Average:");
    const cells = foot.querySelectorAll("td");
    expect(cells[1]).toHaveTextContent(String(Math.round((a.rate + b.rate) / 2)));
    expect(cells[2]).toHaveTextContent("7,800");

    expect(view.container.querySelector(".collapse-prompt-pill")).toBeNull();
    expect(view.container.querySelector("thead")).not.toHaveClass("has-prompt");
    expect(view.container.querySelector("caption")).toHaveTextContent(
      "Samples for trial A: 2 rows.",
    );
  });

  it("marks the collapsed sample on two lines and in its label", () => {
    const { store, view } = setup();
    act(() => store.ui.selectTrial("B"));
    sample(store, 0);
    const [row] = bodyRows(view);
    const cell = row.cells[3];
    expect(cell).toHaveClass("collapse-cell-failed");
    expect(cell.innerHTML).toBe("collapsed<br>(2,800)");
    expect(row.getAttribute("aria-label")).toMatch(/, collapsed$/);
  });

  it("draws the hidden stand-in in the picture cell", () => {
    const { store, view } = setup();
    sample(store, 0);
    const pic = bodyRows(view)[0].cells[0];
    const standin = pic.querySelector(".collapse-pic-standin");
    expect(standin).toHaveAttribute("aria-hidden", "true");
    expect(pic.querySelector("img")).toBeNull();
  });
});

describe("DataTable — sorting", () => {
  it("cycles a column ascending → descending → sampled order, with aria-sort on its th", () => {
    const { store, view } = setup();
    for (const years of [100000, 0, 200000]) sample(store, years);
    const header = () => view.getByRole("columnheader", { name: /Years before collapse/ });
    const button = view.getByRole("button", { name: "Years before collapse" });
    expect(header()).toHaveAttribute("aria-sort", "none");

    fireEvent.click(button);
    expect(displayedYears(view)).toEqual(["0", "100,000", "200,000"]);
    expect(header()).toHaveAttribute("aria-sort", "ascending");
    expect(header()).toHaveAttribute("data-sort-dir", "ascending");

    fireEvent.click(button);
    expect(displayedYears(view)).toEqual(["200,000", "100,000", "0"]);
    expect(header()).toHaveAttribute("aria-sort", "descending");
    expect(header()).toHaveAttribute("data-sort-dir", "descending");

    fireEvent.click(button);
    expect(displayedYears(view)).toEqual(["100,000", "0", "200,000"]);
    expect(header()).toHaveAttribute("aria-sort", "none");
    expect(header()).toHaveAttribute("data-sort-dir", "none");
  });

  it("sorts by erosion rate", () => {
    const { store, view } = setup();
    const rates = [200000, 100000, 0].map((y) => sample(store, y).rate);
    fireEvent.click(view.getByRole("button", { name: "Erosion rate" }));
    const shown = bodyRows(view).map((tr) => Number(tr.cells[2].textContent));
    expect(shown).toEqual([...rates].sort((x, y) => x - y).map(Math.round));
    expect(view.getByRole("columnheader", { name: /Erosion rate/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(view.getByRole("columnheader", { name: /Rock above cave/ })).toHaveAttribute(
      "aria-sort",
      "none",
    );
  });

  it("does not change the averages", () => {
    const { store, view } = setup();
    for (const years of [100000, 0]) sample(store, years);
    const foot = () => view.container.querySelector("tfoot")?.textContent;
    const before = foot();
    fireEvent.click(view.getByRole("button", { name: "Rock above cave" }));
    expect(foot()).toBe(before);
  });
});

describe("DataTable — selecting", () => {
  it("a click toggles the row's selection", () => {
    const { store, view } = setup();
    sample(store, 100000);
    sample(store, 0);
    const [first, second] = bodyRows(view);
    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-current", "true");
    expect(first).toHaveClass("is-selected");
    expect(second).not.toHaveAttribute("aria-current");
    expect(second).not.toHaveClass("is-selected");
    fireEvent.click(first);
    expect(first).not.toHaveAttribute("aria-current");
    expect(store.selectedSample).toBeUndefined();
  });

  it("Enter and Space on the row select it; Space on its delete button does not", () => {
    const { store, view } = setup();
    sample(store, 100000);
    sample(store, 0);
    const [first] = bodyRows(view);
    fireEvent.keyDown(first, { key: "Enter" });
    expect(first).toHaveAttribute("aria-current", "true");
    fireEvent.keyDown(first, { key: " " });
    expect(first).not.toHaveAttribute("aria-current");
    const del = within(first).getByRole("button");
    fireEvent.keyDown(del, { key: " " });
    expect(first).not.toHaveAttribute("aria-current");
  });
});

describe("DataTable — deleting", () => {
  it("deletes the right sample under a sort, by id", () => {
    const { store, view } = setup();
    const a = sample(store, 100000);
    const b = sample(store, 0);
    const c = sample(store, 200000);
    const years = view.getByRole("button", { name: "Years before collapse" });
    fireEvent.click(years);
    fireEvent.click(years);
    expect(displayedYears(view)[0]).toBe("200,000");
    fireEvent.click(
      view.getByRole("button", { name: "Delete the sample at 200,000 years before collapse" }),
    );
    expect(store.activeTrial.samples.map((s) => s.id)).toEqual([a.id, b.id]);
    expect(store.activeTrial.sampleById(c.id)).toBeUndefined();
    expect(displayedYears(view)).toEqual(["100,000", "0"]);
  });

  it("deleting the selected row clears the selection, and does not select another row", () => {
    const { store, view } = setup();
    sample(store, 100000);
    sample(store, 0);
    fireEvent.click(
      view.getByRole("button", { name: "Delete the sample at 0 years before collapse" }),
    );
    expect(store.selectedSample).toBeUndefined();
    expect(bodyRows(view)).toHaveLength(1);
    expect(bodyRows(view)[0]).not.toHaveAttribute("aria-current");
  });

  it("deleting the last row brings back the prompt and drops the average row", () => {
    const { store, view } = setup();
    sample(store, 0);
    fireEvent.click(
      view.getByRole("button", { name: "Delete the sample at 0 years before collapse" }),
    );
    expect(view.container.querySelector(".collapse-prompt-pill")).toBeInTheDocument();
    expect(view.container.querySelector("tfoot")).toBeNull();
  });
});

describe("DataTable — trial switch", () => {
  it("shows each trial's rows, keeps the sort, and restores each trial's selection", () => {
    const { store, view } = setup();
    sample(store, 100000);
    const a2 = sample(store, 0);
    act(() => store.ui.selectTrial("B"));
    expect(bodyRows(view)).toHaveLength(0);
    expect(view.container.querySelector(".collapse-prompt-pill")).toBeInTheDocument();
    const b1 = sample(store, 50000);
    fireEvent.click(view.getByRole("button", { name: "Erosion rate" }));
    act(() => store.ui.selectTrial("A"));
    expect(displayedYears(view)).toHaveLength(2);
    expect(view.getByRole("columnheader", { name: /Erosion rate/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(store.selectedSample?.id).toBe(a2.id);
    act(() => store.ui.selectTrial("B"));
    expect(store.selectedSample?.id).toBe(b1.id);
    expect(view.container.querySelector("caption")).toHaveTextContent(
      "Samples for trial B: 1 row.",
    );
  });

  it("never reuses a row element from the previous trial", () => {
    const { store, view } = setup();
    sample(store, 100000);
    act(() => store.ui.selectTrial("B"));
    sample(store, 100000);
    act(() => store.ui.selectTrial("A"));
    const rowA = bodyRows(view)[0];
    expect(rowA).toHaveAttribute("data-row-key", "A:1");
    act(() => rowA.focus());
    expect(document.activeElement).toBe(rowA);
    act(() => store.ui.selectTrial("B"));
    const rowB = bodyRows(view)[0];
    expect(rowB).toHaveAttribute("data-row-key", "B:1");
    expect(rowB).not.toBe(rowA);
    expect(rowA.isConnected).toBe(false);
    expect(document.activeElement).not.toBe(rowB);
  });
});

describe("DataTable — keyboard", () => {
  function threeRows() {
    const ctx = setup();
    for (const years of [200000, 100000, 0]) sample(ctx.store, years);
    return { ...ctx, rows: bodyRows(ctx.view) };
  }

  it("ArrowDown and ArrowUp move focus row to row, with the keyboard ring", () => {
    const { rows } = threeRows();
    act(() => rows[0].focus());
    fireEvent.keyDown(rows[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(rows[1]);
    expect(rows[1]).toHaveClass("kb-focus");
    expect(rows[0]).not.toHaveClass("kb-focus");
    fireEvent.keyDown(rows[1], { key: "ArrowUp" });
    expect(document.activeElement).toBe(rows[0]);
    expect(rows[0]).toHaveClass("kb-focus");
  });

  it("End and Home go to the last and first rows", () => {
    const { rows } = threeRows();
    act(() => rows[0].focus());
    fireEvent.keyDown(rows[0], { key: "End" });
    expect(document.activeElement).toBe(rows[2]);
    fireEvent.keyDown(rows[2], { key: "Home" });
    expect(document.activeElement).toBe(rows[0]);
  });

  it("a Tab arrival gets the ring; a click does not", () => {
    const { rows } = threeRows();
    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => rows[1].focus());
    expect(rows[1]).toHaveClass("kb-focus");
    fireEvent.pointerDown(rows[2]);
    act(() => rows[2].focus());
    fireEvent.click(rows[2]);
    expect(rows[2]).not.toHaveClass("kb-focus");
    expect(rows[1]).not.toHaveClass("kb-focus");
  });

  it("ArrowRight goes to the row's delete button and ArrowLeft comes back", () => {
    const { rows } = threeRows();
    act(() => rows[1].focus());
    fireEvent.keyDown(rows[1], { key: "ArrowRight" });
    const del = within(rows[1]).getByRole("button");
    expect(document.activeElement).toBe(del);
    fireEvent.keyDown(del, { key: "ArrowDown" });
    expect(document.activeElement).toBe(within(rows[2]).getByRole("button"));
    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(rows[2]);
  });

  it("ArrowUp from the first row goes to the heading the student came down through", () => {
    const { rows, view } = threeRows();
    const rate = view.getByRole("button", { name: "Erosion rate" });
    act(() => rate.focus());
    fireEvent.keyDown(rate, { key: "ArrowDown" });
    expect(document.activeElement).toBe(rows[0]);
    fireEvent.keyDown(rows[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(rate);
  });

  it("ArrowUp from the first row, entered by Tab, goes to the first heading", () => {
    const { rows, view } = threeRows();
    act(() => rows[0].focus());
    fireEvent.keyDown(rows[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(
      view.getByRole("button", { name: "Years before collapse" }),
    );
  });

  it("ArrowLeft and ArrowRight move between the headings", () => {
    const { view } = setup();
    const years = view.getByRole("button", { name: "Years before collapse" });
    const rate = view.getByRole("button", { name: "Erosion rate" });
    const roof = view.getByRole("button", { name: "Rock above cave" });
    act(() => years.focus());
    fireEvent.keyDown(years, { key: "ArrowRight" });
    expect(document.activeElement).toBe(rate);
    fireEvent.keyDown(rate, { key: "ArrowRight" });
    expect(document.activeElement).toBe(roof);
    fireEvent.keyDown(roof, { key: "ArrowRight" });
    expect(document.activeElement).toBe(roof);
    fireEvent.keyDown(roof, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(rate);
  });

  it("ArrowDown on a heading enters the rows at the top, not at the selected row", () => {
    const { rows, view } = threeRows();
    expect(rows[2]).toHaveAttribute("aria-current", "true");
    const roof = view.getByRole("button", { name: "Rock above cave" });
    act(() => roof.focus());
    fireEvent.keyDown(roof, { key: "ArrowDown" });
    expect(document.activeElement).toBe(rows[0]);
  });

  it("focus survives a sort", () => {
    const { rows, view } = threeRows();
    act(() => rows[0].focus());
    fireEvent.click(view.getByRole("button", { name: "Years before collapse" }));
    expect(document.activeElement).toBe(rows[0]);
  });
});

describe("DataTable — focus after a delete", () => {
  it("returns to the same row position, clamped to the last row", () => {
    const ctx = setup();
    for (const years of [200000, 100000, 0]) sample(ctx.store, years);
    const delOf = (i: number) => within(bodyRows(ctx.view)[i]).getByRole("button");

    // From the middle row's delete button: focus lands on the next row's delete button.
    act(() => delOf(1).focus());
    fireEvent.click(delOf(1));
    expect(displayedYears(ctx.view)).toEqual(["200,000", "0"]);
    expect(document.activeElement).toBe(delOf(1));

    // From the last row itself (deleted with the keyboard): back on the new last row.
    const last = bodyRows(ctx.view)[1];
    act(() => last.focus());
    fireEvent.keyDown(last, { key: "Enter" });
    fireEvent.click(delOf(1));
    expect(document.activeElement).toBe(bodyRows(ctx.view)[0]);
  });

  it("goes to the first sort heading when the last row is deleted, never to the page", () => {
    const { store, view } = setup();
    sample(store, 0);
    const del = view.getByRole("button", { name: "Delete the sample at 0 years before collapse" });
    act(() => del.focus());
    fireEvent.click(del);
    expect(bodyRows(view)).toHaveLength(0);
    expect(document.activeElement).toBe(
      view.getByRole("button", { name: "Years before collapse" }),
    );
    expect(document.activeElement).not.toBe(document.body);
  });
});
