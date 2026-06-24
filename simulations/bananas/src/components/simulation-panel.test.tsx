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
const twoCrosses = (overrides?: { selectedCross?: number | null }) =>
  createTestStore({
    trial: {
      p1: "wild-w1",
      p2: "cavendish-c1",
      locked: true,
      crosses: [
        [plant("Rr", true), plant("rr", false)],
        [plant("Rr", true), plant("Rr", true)],
      ],
    },
    ui: { selectedCross: overrides?.selectedCross ?? null },
  });

// The cross-row buttons share the "Cross N, …" aria-label shape; this regex excludes the
// "Cross Plants" control button so getAllByRole targets only the selectable rows.
const ROW_NAME = /^Cross \d+,/;

describe("SimulationPanel rendering", () => {
  it("renders selectors, the grid hint, and no pill for an empty trial", () => {
    const { getByLabelText, getByText, queryByRole } = renderPanel(createTestStore());
    expect(getByLabelText("Parent 1")).toBeInTheDocument();
    expect(getByLabelText("Parent 2")).toBeInTheDocument();
    expect(getByText(/Each cross will produce 5–20 offspring\./i)).toBeInTheDocument();
    expect(queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the cross-prompt pill once both parents are set", () => {
    const { getByRole } = renderPanel(bothParents());
    expect(getByRole("status")).toHaveTextContent("Click Cross Plants to see their offspring");
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
    expect(getByRole("button", { name: "Cross Plants" })).toBeDisabled();
    expect(getByRole("switch", { name: "Fungus" })).toBeDisabled();
  });
});

describe("SimulationPanel derived control states", () => {
  it("disables Cross Plants and Fungus until both parents are selected", () => {
    const { getByRole } = renderPanel(createTestStore({ trial: { p1: "wild-w1" } }));
    expect(getByRole("button", { name: "Cross Plants" })).toBeDisabled();
    expect(getByRole("switch", { name: "Fungus" })).toBeDisabled();
  });

  it("enables Cross Plants and Fungus when both parents are selected and no crosses yet", () => {
    const { getByRole } = renderPanel(bothParents());
    expect(getByRole("button", { name: "Cross Plants" })).not.toBeDisabled();
    expect(getByRole("switch", { name: "Fungus" })).not.toBeDisabled();
  });

  it("disables Reset for an empty trial and enables it once a parent is chosen", () => {
    const empty = renderPanel(createTestStore());
    expect(empty.getByRole("button", { name: "Reset Trial" })).toBeDisabled();
    empty.unmount();
    const withParent = renderPanel(createTestStore({ trial: { p1: "wild-w1" } }));
    expect(withParent.getByRole("button", { name: "Reset Trial" })).not.toBeDisabled();
  });
});

describe("SimulationPanel store integration", () => {
  it("crosses plants into the store when Cross Plants is pressed", () => {
    const store = bothParents();
    const { getByRole } = renderPanel(store);
    fireEvent.click(getByRole("button", { name: "Cross Plants" }));
    expect(store.trial.crosses).toHaveLength(1);
  });

  it("sets a parent on the store when chosen from the Select", () => {
    const store = createTestStore();
    const { getByRole } = renderPanel(store);
    fireEvent.click(getByRole("button", { name: /Parent 1/i }));
    fireEvent.click(getByRole("option", { name: "Wild W1" }));
    expect(store.trial.p1).toBe("wild-w1");
  });

  it("resets the store when Reset Trial is pressed", () => {
    const store = lockedOneCross();
    const { getByRole } = renderPanel(store);
    fireEvent.click(getByRole("button", { name: "Reset Trial" }));
    expect(store.trial.crosses).toHaveLength(0);
    expect(store.trial.canReset).toBe(false);
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
      store.trial.crossPlants();
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
