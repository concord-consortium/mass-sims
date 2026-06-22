import { fireEvent, render } from "@testing-library/react";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

// The shared Select/Button import useLogEvent internally, so mock the log() transport — the seam a
// sim test can reach — to silence child logging (these tests assert callbacks, not events).
// vi.hoisted so the mock exists when vi.mock runs.
const { log } = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("@concord-consortium/lara-interactive-api", () => ({ log }));

import type { OffspringPlant } from "../model/genetics";
import { emptyTrial, type TrialState } from "../model/trial";
import { SimulationPanel } from "./simulation-panel";

// SimulationPanel is controlled: App owns the state, so these tests drive it by trial prop and
// assert (a) the rendered view for a given trial and (b) that user actions fire the callbacks.

function plant(genotype: string, isResistant: boolean, infected = false): OffspringPlant {
  return { genotype, isResistant, infected };
}
function trial(overrides: Partial<TrialState> = {}): TrialState {
  return { ...emptyTrial(), ...overrides };
}
function handlers() {
  return {
    selectedCross: null,
    onSelectCross: vi.fn(),
    gridRef: { current: null } as RefObject<HTMLElement | null>,
    onSelectParent1: vi.fn(),
    onSelectParent2: vi.fn(),
    onCrossPlants: vi.fn(),
    onSetFungus: vi.fn(),
    onResetTrial: vi.fn(),
  };
}

const BOTH_PARENTS = trial({ p1: "wild-w1", p2: "cavendish-c1" });
const LOCKED_ONE_CROSS = trial({
  p1: "wild-w1",
  p2: "cavendish-c1",
  locked: true,
  crosses: [[plant("Rr", true), plant("rr", false)]],
});
const TWO_CROSSES = trial({
  p1: "wild-w1",
  p2: "cavendish-c1",
  locked: true,
  crosses: [
    [plant("Rr", true), plant("rr", false)],
    [plant("Rr", true), plant("Rr", true)],
  ],
});

// The cross-row buttons share the "Cross N, …" aria-label shape; this regex excludes the
// "Cross Plants" control button so getAllByRole targets only the selectable rows.
const ROW_NAME = /^Cross \d+,/;

describe("SimulationPanel rendering", () => {
  it("renders selectors, the grid hint, and no pill for an empty trial", () => {
    const { getByLabelText, getByText, queryByRole } = render(
      <SimulationPanel trial={emptyTrial()} {...handlers()} />,
    );
    expect(getByLabelText("Parent 1")).toBeInTheDocument();
    expect(getByLabelText("Parent 2")).toBeInTheDocument();
    expect(getByText(/Each cross will produce 5–20 offspring\./i)).toBeInTheDocument();
    expect(queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the cross-prompt pill once both parents are set", () => {
    const { getByRole } = render(<SimulationPanel trial={BOTH_PARENTS} {...handlers()} />);
    expect(getByRole("status")).toHaveTextContent("Click Cross Plants to see their offspring");
  });

  it("shows the fungus-active prompt and 'Fungus introduced' marker when fungus is on", () => {
    const fungusOn = trial({ p1: "wild-w1", p2: "cavendish-c1", fungusOn: true });
    const { getByRole, getByText } = render(<SimulationPanel trial={fungusOn} {...handlers()} />);
    expect(getByRole("status")).toHaveTextContent(
      "Cross plants to see their offspring · Fungus active",
    );
    expect(getByText("Fungus introduced")).toBeInTheDocument();
  });

  it("renders chips, the cross row, and the stats pill for a locked trial", () => {
    const { getByText, getByRole, getAllByRole, queryByRole } = render(
      <SimulationPanel trial={LOCKED_ONE_CROSS} {...handlers()} />,
    );
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
    const infected = trial({
      p1: "wild-w1",
      p2: "cavendish-c1",
      locked: true,
      fungusOn: true,
      crosses: [[plant("rr", false, true), plant("Rr", true, false)]],
    });
    const { container } = render(<SimulationPanel trial={infected} {...handlers()} />);
    expect(container.querySelectorAll(".offspring-plant")).toHaveLength(2);
    expect(container.querySelectorAll(".offspring-plant.infected")).toHaveLength(1);
  });

  it("shows the max-crosses placeholder and disables Cross Plants + Fungus at the cap", () => {
    const capped = trial({
      p1: "wild-w1",
      p2: "cavendish-c1",
      locked: true,
      crosses: Array.from({ length: 6 }, () => [plant("Rr", true)]),
    });
    const { getByRole, container } = render(<SimulationPanel trial={capped} {...handlers()} />);
    expect(container.querySelector(".offspring-grid-max")).toHaveTextContent(
      "Max number of crosses reached",
    );
    expect(getByRole("button", { name: "Cross Plants" })).toBeDisabled();
    expect(getByRole("switch", { name: "Fungus" })).toBeDisabled();
  });
});

describe("SimulationPanel derived control states", () => {
  it("disables Cross Plants and Fungus until both parents are selected", () => {
    const { getByRole } = render(
      <SimulationPanel trial={trial({ p1: "wild-w1" })} {...handlers()} />,
    );
    expect(getByRole("button", { name: "Cross Plants" })).toBeDisabled();
    expect(getByRole("switch", { name: "Fungus" })).toBeDisabled();
  });

  it("enables Cross Plants and Fungus when both parents are selected and no crosses yet", () => {
    const { getByRole } = render(<SimulationPanel trial={BOTH_PARENTS} {...handlers()} />);
    expect(getByRole("button", { name: "Cross Plants" })).not.toBeDisabled();
    expect(getByRole("switch", { name: "Fungus" })).not.toBeDisabled();
  });

  it("disables Reset for an empty trial and enables it once a parent is chosen", () => {
    const empty = render(<SimulationPanel trial={emptyTrial()} {...handlers()} />);
    expect(empty.getByRole("button", { name: "Reset Trial" })).toBeDisabled();
    empty.unmount();
    const withParent = render(<SimulationPanel trial={trial({ p1: "wild-w1" })} {...handlers()} />);
    expect(withParent.getByRole("button", { name: "Reset Trial" })).not.toBeDisabled();
  });
});

describe("SimulationPanel callbacks", () => {
  it("calls onSelectParent1 with the chosen id", () => {
    const h = handlers();
    const { getByRole } = render(<SimulationPanel trial={emptyTrial()} {...h} />);
    fireEvent.click(getByRole("button", { name: /Parent 1/i }));
    fireEvent.click(getByRole("option", { name: "Wild W1" }));
    expect(h.onSelectParent1).toHaveBeenCalledWith("wild-w1");
  });

  it("calls onCrossPlants when Cross Plants is pressed", () => {
    const h = handlers();
    const { getByRole } = render(<SimulationPanel trial={BOTH_PARENTS} {...h} />);
    fireEvent.click(getByRole("button", { name: "Cross Plants" }));
    expect(h.onCrossPlants).toHaveBeenCalledTimes(1);
  });

  it("calls onSetFungus when the Fungus switch is toggled", () => {
    const h = handlers();
    const { getByRole } = render(<SimulationPanel trial={BOTH_PARENTS} {...h} />);
    fireEvent.click(getByRole("switch", { name: "Fungus" }));
    expect(h.onSetFungus).toHaveBeenCalledWith(true);
  });

  it("calls onResetTrial when Reset Trial is pressed", () => {
    const h = handlers();
    const { getByRole } = render(<SimulationPanel trial={BOTH_PARENTS} {...h} />);
    fireEvent.click(getByRole("button", { name: "Reset Trial" }));
    expect(h.onResetTrial).toHaveBeenCalledTimes(1);
  });
});

describe("SimulationPanel auto-scroll", () => {
  it("scrolls the grid to the bottom when a new cross is appended", () => {
    const { container, rerender } = render(
      <SimulationPanel trial={LOCKED_ONE_CROSS} {...handlers()} />,
    );
    const grid = container.querySelector(".offspring-grid") as HTMLElement;
    // jsdom has no layout (scrollHeight is 0), so simulate an overflowing grid.
    Object.defineProperty(grid, "scrollHeight", { value: 500, configurable: true });
    grid.scrollTop = 0;
    const twoCrosses = {
      ...LOCKED_ONE_CROSS,
      crosses: [...LOCKED_ONE_CROSS.crosses, [plant("rr", false)]],
    };
    rerender(<SimulationPanel trial={twoCrosses} {...handlers()} />);
    expect(grid.scrollTop).toBe(500);
  });
});

describe("SimulationPanel cross selection", () => {
  it("marks no row selected when selectedCross is null", () => {
    const { container } = render(<SimulationPanel trial={TWO_CROSSES} {...handlers()} />);
    expect(container.querySelectorAll(".offspring-row--selected")).toHaveLength(0);
  });

  it("calls onSelectCross with the clicked row's index", () => {
    const h = handlers();
    const { getAllByRole } = render(<SimulationPanel trial={TWO_CROSSES} {...h} />);
    fireEvent.click(getAllByRole("button", { name: ROW_NAME })[0]);
    expect(h.onSelectCross).toHaveBeenCalledWith(0);
  });

  it("calls onSelectCross(null) when the already-selected row is clicked (toggle)", () => {
    const h = handlers();
    const { getAllByRole } = render(
      <SimulationPanel trial={TWO_CROSSES} {...h} selectedCross={0} />,
    );
    fireEvent.click(getAllByRole("button", { name: ROW_NAME })[0]);
    expect(h.onSelectCross).toHaveBeenCalledWith(null);
  });

  it("selects a row on Enter", () => {
    const h = handlers();
    const { getAllByRole } = render(<SimulationPanel trial={TWO_CROSSES} {...h} />);
    fireEvent.keyDown(getAllByRole("button", { name: ROW_NAME })[1], { key: "Enter" });
    expect(h.onSelectCross).toHaveBeenCalledWith(1);
  });

  it("selects a row on Space", () => {
    const h = handlers();
    const { getAllByRole } = render(<SimulationPanel trial={TWO_CROSSES} {...h} />);
    fireEvent.keyDown(getAllByRole("button", { name: ROW_NAME })[0], { key: " " });
    expect(h.onSelectCross).toHaveBeenCalledWith(0);
  });

  it("sets aria-pressed only on the selected row", () => {
    const { getAllByRole } = render(
      <SimulationPanel trial={TWO_CROSSES} {...handlers()} selectedCross={1} />,
    );
    const rows = getAllByRole("button", { name: ROW_NAME });
    expect(rows[0]).toHaveAttribute("aria-pressed", "false");
    expect(rows[1]).toHaveAttribute("aria-pressed", "true");
  });
});
