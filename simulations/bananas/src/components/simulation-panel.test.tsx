import { act, fireEvent, render } from "@testing-library/react";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

// The shared Select/Button import useLogEvent internally, so mock the log() transport — the seam a
// sim test can reach — to silence child logging (these tests assert store effects + DOM, not events).
// vi.hoisted so the mock exists when vi.mock runs.
const { log } = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("@concord-consortium/lara-interactive-api", () => ({ log }));

import type { OffspringPlant } from "../model/genetics";
import { type RootStoreInstance, RootStoreProvider } from "../stores/root-store";
import { createTestStore } from "../stores/test-helpers";
import { SimulationPanel } from "./simulation-panel";

// SimulationPanel reads the store via useStores(); tests seed a store, mount it through the
// provider, and assert (a) the rendered view for that store and (b) that user actions drive the
// store (asserted on store views or via spies on store actions).

function plant(genotype: string, isResistant: boolean, infected = false): OffspringPlant {
  return { genotype, isResistant, infected };
}

function renderPanel(
  store: RootStoreInstance,
  gridRef: RefObject<HTMLElement | null> = { current: null },
) {
  return render(
    <RootStoreProvider store={store}>
      <SimulationPanel gridRef={gridRef} />
    </RootStoreProvider>,
  );
}

const bothParents = () => createTestStore({ trial: { p1: "wild-w1", p2: "cavendish-c1" } });
const lockedOneCross = () =>
  createTestStore({
    trial: {
      p1: "wild-w1",
      p2: "cavendish-c1",
      locked: true,
      crosses: [[plant("Rr", true), plant("rr", false)]],
    },
  });
const twoCrosses = (overrides?: { selectedCross?: number | null }) => {
  const sel = overrides?.selectedCross;
  return createTestStore({
    trial: {
      p1: "wild-w1",
      p2: "cavendish-c1",
      locked: true,
      crosses: [
        [plant("Rr", true), plant("rr", false)],
        [plant("Rr", true), plant("Rr", true)],
      ],
    },
    ui: { selectedCrossByTrial: sel == null ? {} : { A: sel } },
  });
};

// The cross-row buttons share the "Cross N, …" aria-label shape; this regex excludes the
// "Cross Plants" control button so getAllByRole targets only the selectable rows.
const ROW_NAME = /^Cross \d+,/;

describe("SimulationPanel rendering", () => {
  it("renders selectors but no pill or grid hint for an empty trial", () => {
    const { getByLabelText, queryByText, queryByRole } = renderPanel(createTestStore());
    expect(getByLabelText("Parent 1")).toBeInTheDocument();
    expect(getByLabelText("Parent 2")).toBeInTheDocument();
    // The offspring hint and the status pill both appear only once both parents are selected.
    expect(queryByText(/Each cross will produce 5–20 offspring\./i)).not.toBeInTheDocument();
    expect(queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the cross-prompt pill and grid hint once both parents are set", () => {
    const { getByRole, getByText } = renderPanel(bothParents());
    expect(getByRole("status")).toHaveTextContent("Click Cross Plants to see their offspring");
    expect(getByText(/Each cross will produce 5–20 offspring\./i)).toBeInTheDocument();
  });

  it("shows the fungus-active prompt and 'Fungus introduced' marker when fungus is on", () => {
    const { getByRole, getByText } = renderPanel(
      createTestStore({ trial: { p1: "wild-w1", p2: "cavendish-c1", fungusOn: true } }),
    );
    expect(getByRole("status")).toHaveTextContent(
      "Cross plants to see their offspring · Fungus active",
    );
    expect(getByText("Fungus introduced")).toBeInTheDocument();
  });

  it("renders chips, the cross row, and the stats pill for a locked trial", () => {
    const { getByText, getByRole, getAllByRole, queryByRole } = renderPanel(lockedOneCross());
    // Locked → static chips, no interactive selectors.
    expect(queryByRole("button", { name: /Parent 1/i })).not.toBeInTheDocument();
    expect(getByText("Wild W1")).toBeInTheDocument();
    expect(getByText("Cavendish C1")).toBeInTheDocument();
    const rows = getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("A1");
    expect(getByRole("status")).toHaveTextContent(/Crosses:\s*1\s*·\s*Offspring:\s*2/);
  });

  it("marks infected offspring with the infected class", () => {
    const { container } = renderPanel(
      createTestStore({
        trial: {
          p1: "wild-w1",
          p2: "cavendish-c1",
          locked: true,
          fungusOn: true,
          crosses: [[plant("rr", false, true), plant("Rr", true, false)]],
        },
      }),
    );
    expect(container.querySelectorAll(".offspring-plant")).toHaveLength(2);
    expect(container.querySelectorAll(".offspring-plant.infected")).toHaveLength(1);
  });

  it("shows the max-crosses placeholder and disables Cross Plants + Fungus at the cap", () => {
    const { getByRole, container } = renderPanel(
      createTestStore({
        trial: {
          p1: "wild-w1",
          p2: "cavendish-c1",
          locked: true,
          crosses: Array.from({ length: 6 }, () => [plant("Rr", true)]),
        },
      }),
    );
    expect(container.querySelector(".offspring-grid-max")).toHaveTextContent(
      "Max number of crosses reached",
    );
    expect(getByRole("button", { name: "Cross Plants" })).toHaveAttribute("aria-disabled", "true");
    expect(getByRole("switch", { name: "Fungus" })).toHaveAttribute("aria-disabled", "true");
  });
});

describe("SimulationPanel offspring grid scroll region", () => {
  it("wraps the grid as a focusable scroll region with a focus ring sibling", () => {
    const { container } = renderPanel(bothParents());
    const grid = container.querySelector(".offspring-grid") as HTMLElement;
    expect(grid).toHaveClass("scroll-region");
    const wrap = grid.parentElement as HTMLElement;
    expect(wrap).toHaveClass("offspring-grid-wrap");
    expect(wrap.querySelector(".scroll-focus-ring")).toBeInTheDocument();
  });
});

describe("SimulationPanel active-trial badge", () => {
  it("renders the active-trial letter and updates when the active trial changes", () => {
    const store = createTestStore();
    const { container } = renderPanel(store);
    expect(container.querySelector(".active-trial-badge")).toHaveTextContent("A");
    act(() => {
      store.ui.selectTrial("B");
    });
    expect(container.querySelector(".active-trial-badge")).toHaveTextContent("B");
  });
});

describe("SimulationPanel derived control states", () => {
  it("disables Cross Plants and Fungus until both parents are selected", () => {
    const { getByRole } = renderPanel(createTestStore({ trial: { p1: "wild-w1" } }));
    expect(getByRole("button", { name: "Cross Plants" })).toHaveAttribute("aria-disabled", "true");
    expect(getByRole("switch", { name: "Fungus" })).toHaveAttribute("aria-disabled", "true");
  });

  it("enables Cross Plants and Fungus when both parents are selected and no crosses yet", () => {
    const { getByRole } = renderPanel(bothParents());
    expect(getByRole("button", { name: "Cross Plants" })).not.toHaveAttribute("aria-disabled");
    expect(getByRole("switch", { name: "Fungus" })).not.toHaveAttribute("aria-disabled");
  });

  it("disables Reset for an empty trial and enables it once a parent is chosen", () => {
    const empty = renderPanel(createTestStore());
    expect(empty.getByRole("button", { name: "Reset Trial" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    empty.unmount();
    const withParent = renderPanel(createTestStore({ trial: { p1: "wild-w1" } }));
    expect(withParent.getByRole("button", { name: "Reset Trial" })).not.toHaveAttribute(
      "aria-disabled",
    );
  });
});

describe("SimulationPanel store integration", () => {
  it("crosses plants into the store when Cross Plants is pressed", () => {
    const store = bothParents();
    const { getByRole } = renderPanel(store);
    fireEvent.click(getByRole("button", { name: "Cross Plants" }));
    expect(store.activeTrial.crosses).toHaveLength(1);
  });

  it("sets a parent on the store when chosen from the Select", () => {
    const store = createTestStore();
    const { getByRole } = renderPanel(store);
    fireEvent.click(getByRole("button", { name: /Parent 1/i }));
    fireEvent.click(getByRole("option", { name: "Wild W1" }));
    expect(store.activeTrial.p1).toBe("wild-w1");
  });

  it("resets the store when Reset Trial is pressed", () => {
    const store = lockedOneCross();
    const { getByRole } = renderPanel(store);
    fireEvent.click(getByRole("button", { name: "Reset Trial" }));
    expect(store.activeTrial.crosses).toHaveLength(0);
    expect(store.activeTrial.canReset).toBe(false);
  });
});

describe("SimulationPanel auto-scroll", () => {
  it("scrolls the grid to the bottom when a new cross is appended", () => {
    const store = lockedOneCross();
    const { container } = renderPanel(store);
    const grid = container.querySelector(".offspring-grid") as HTMLElement;
    // jsdom has no layout (scrollHeight is 0), so simulate an overflowing grid.
    Object.defineProperty(grid, "scrollHeight", { value: 500, configurable: true });
    grid.scrollTop = 0;
    // Append a cross via the store; observer re-renders the panel, retriggering the scroll effect.
    act(() => {
      store.activeTrial.crossPlants();
    });
    expect(grid.scrollTop).toBe(500);
  });
});

describe("SimulationPanel cross selection", () => {
  it("marks no row selected when nothing is selected", () => {
    const { container } = renderPanel(twoCrosses());
    expect(container.querySelectorAll(".offspring-row--selected")).toHaveLength(0);
  });

  // Assert the selection effect via the bounds-checked `activeCross` view (never the raw stored index
  // directly — see the Selection access contract).
  it("selects the clicked row", () => {
    const store = twoCrosses();
    const { getAllByRole } = renderPanel(store);
    fireEvent.click(getAllByRole("button", { name: ROW_NAME })[0]);
    expect(store.activeCross).toBe(0);
  });

  it("clears the selection when the already-selected row is clicked (toggle)", () => {
    const store = twoCrosses({ selectedCross: 0 });
    const { getAllByRole } = renderPanel(store);
    fireEvent.click(getAllByRole("button", { name: ROW_NAME })[0]);
    expect(store.activeCross).toBeNull();
  });

  it("selects a row on Enter", () => {
    const store = twoCrosses();
    const { getAllByRole } = renderPanel(store);
    fireEvent.keyDown(getAllByRole("button", { name: ROW_NAME })[1], { key: "Enter" });
    expect(store.activeCross).toBe(1);
  });

  it("selects a row on Space", () => {
    const store = twoCrosses();
    const { getAllByRole } = renderPanel(store);
    fireEvent.keyDown(getAllByRole("button", { name: ROW_NAME })[0], { key: " " });
    expect(store.activeCross).toBe(0);
  });

  it("sets aria-pressed only on the selected row", () => {
    const { getAllByRole } = renderPanel(twoCrosses({ selectedCross: 1 }));
    const rows = getAllByRole("button", { name: ROW_NAME });
    expect(rows[0]).toHaveAttribute("aria-pressed", "false");
    expect(rows[1]).toHaveAttribute("aria-pressed", "true");
  });
});

// A store with three crosses so wrap-around has a clear middle row to distinguish from the ends.
const threeCrosses = (overrides?: { selectedCross?: number | null }) => {
  const sel = overrides?.selectedCross;
  return createTestStore({
    trial: {
      p1: "wild-w1",
      p2: "cavendish-c1",
      locked: true,
      crosses: [
        [plant("Rr", true), plant("rr", false)],
        [plant("Rr", true), plant("Rr", true)],
        [plant("rr", false), plant("rr", false)],
      ],
    },
    ui: { selectedCrossByTrial: sel == null ? {} : { A: sel } },
  });
};

describe("SimulationPanel offspring roving tabindex", () => {
  it("makes only the first row tabbable when nothing is selected", () => {
    const { getAllByRole } = renderPanel(threeCrosses());
    const rows = getAllByRole("button", { name: ROW_NAME });
    expect(rows[0]).toHaveAttribute("tabindex", "0");
    expect(rows[1]).toHaveAttribute("tabindex", "-1");
    expect(rows[2]).toHaveAttribute("tabindex", "-1");
  });

  it("makes only the selected row tabbable when a cross is selected", () => {
    const { getAllByRole } = renderPanel(threeCrosses({ selectedCross: 1 }));
    const rows = getAllByRole("button", { name: ROW_NAME });
    expect(rows[0]).toHaveAttribute("tabindex", "-1");
    expect(rows[1]).toHaveAttribute("tabindex", "0");
    expect(rows[2]).toHaveAttribute("tabindex", "-1");
  });

  it("moves the tab stop to a row when it becomes selected", () => {
    const store = threeCrosses();
    const { getAllByRole } = renderPanel(store);
    act(() => {
      store.ui.selectCross(2);
    });
    const rows = getAllByRole("button", { name: ROW_NAME });
    expect(rows[2]).toHaveAttribute("tabindex", "0");
    expect(rows[0]).toHaveAttribute("tabindex", "-1");
  });
});

describe("SimulationPanel offspring arrow navigation", () => {
  it("ArrowDown moves focus and the tab stop to the next row without selecting", () => {
    const store = threeCrosses();
    const { getAllByRole } = renderPanel(store);
    const rows = getAllByRole("button", { name: ROW_NAME });
    act(() => rows[0].focus());
    fireEvent.keyDown(rows[0], { key: "ArrowDown" });
    expect(rows[1]).toHaveFocus();
    expect(rows[1]).toHaveAttribute("tabindex", "0");
    expect(rows[0]).toHaveAttribute("tabindex", "-1");
    // Focus-only: selection is untouched.
    expect(store.activeCross).toBeNull();
  });

  it("ArrowUp moves focus to the previous row", () => {
    const store = threeCrosses();
    const { getAllByRole } = renderPanel(store);
    const rows = getAllByRole("button", { name: ROW_NAME });
    act(() => rows[2].focus());
    fireEvent.keyDown(rows[2], { key: "ArrowUp" });
    expect(rows[1]).toHaveFocus();
  });

  it("ArrowDown on the last row wraps to the first", () => {
    const store = threeCrosses();
    const { getAllByRole } = renderPanel(store);
    const rows = getAllByRole("button", { name: ROW_NAME });
    act(() => rows[2].focus());
    fireEvent.keyDown(rows[2], { key: "ArrowDown" });
    expect(rows[0]).toHaveFocus();
    expect(rows[0]).toHaveAttribute("tabindex", "0");
  });

  it("ArrowUp on the first row wraps to the last", () => {
    const store = threeCrosses();
    const { getAllByRole } = renderPanel(store);
    const rows = getAllByRole("button", { name: ROW_NAME });
    act(() => rows[0].focus());
    fireEvent.keyDown(rows[0], { key: "ArrowUp" });
    expect(rows[2]).toHaveFocus();
    expect(rows[2]).toHaveAttribute("tabindex", "0");
  });

  it("Home and End jump focus to the first and last rows", () => {
    const store = threeCrosses();
    const { getAllByRole } = renderPanel(store);
    const rows = getAllByRole("button", { name: ROW_NAME });
    act(() => rows[1].focus());
    fireEvent.keyDown(rows[1], { key: "End" });
    expect(rows[2]).toHaveFocus();
    fireEvent.keyDown(rows[2], { key: "Home" });
    expect(rows[0]).toHaveFocus();
  });

  it("keeps the tab stop in sync when a row is focused programmatically", () => {
    const { getAllByRole } = renderPanel(threeCrosses());
    const rows = getAllByRole("button", { name: ROW_NAME });
    act(() => rows[2].focus());
    expect(rows[2]).toHaveAttribute("tabindex", "0");
    expect(rows[0]).toHaveAttribute("tabindex", "-1");
  });
});
