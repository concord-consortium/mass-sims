import { seededRandom } from "@concord-consortium/mass-sims-shared";
import { fireEvent, render, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the lara-interactive-api surface used across the App tree: `log` (control/switch/select
// logging via useLogEvent) and the AP saved-state pair. vi.hoisted so the mocks exist when
// vi.mock runs; defaults to standalone (useInitMessage → null), overridden per-case.
const { log, setInteractiveState, useInitMessage } = vi.hoisted(() => ({
  log: vi.fn(),
  setInteractiveState: vi.fn(),
  useInitMessage: vi.fn(),
}));
vi.mock("@concord-consortium/lara-interactive-api", () => ({
  log,
  setInteractiveState,
  useInitMessage,
}));

import { App } from "./app";
import type { TrialState } from "./model/trial";

// Drives a parent <Select> the way a user would: open the trigger, click an option. The
// trigger's accessible name includes its label ("Parent 1" / "Parent 2"), so the two dropdowns
// and the three control buttons are all addressable by name.
function selectParent(
  getByRole: ReturnType<typeof render>["getByRole"],
  parentLabel: RegExp,
  optionName: string,
) {
  fireEvent.click(getByRole("button", { name: parentLabel }));
  fireEvent.click(getByRole("option", { name: optionName }));
}

function selectBothParents(getByRole: ReturnType<typeof render>["getByRole"]) {
  selectParent(getByRole, /Parent 1/i, "Wild W1");
  selectParent(getByRole, /Parent 2/i, "Cavendish C1");
}

beforeEach(() => {
  // Standalone by default — App derives `isEmbedded = initMsg !== null`, and the real
  // useInitMessage returns null (not undefined) with no AP parent. Embedded tests override.
  useInitMessage.mockReturnValue(null);
  log.mockReset();
  setInteractiveState.mockReset();
});

describe("Bananas App — frame", () => {
  it("renders the SimulationFrame title", () => {
    const { getByRole } = render(<App />);
    expect(getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders the three slot regions with their canonical names", () => {
    const { getByRole } = render(<App />);
    expect(getByRole("region", { name: "Trials" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Simulation" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Data" })).toBeInTheDocument();
  });
});

describe("Bananas App — simulation flow", () => {
  it("renders the selectors, offspring grid, and controls with NO status pill", () => {
    const { getByLabelText, getByRole, queryByRole } = render(<App />);
    expect(getByLabelText("Parent 1")).toBeInTheDocument();
    expect(getByRole("list", { name: /crosses/i })).toBeInTheDocument();
    expect(getByRole("button", { name: "Cross Plants" })).toBeInTheDocument();
    // The pill (and its live region) are absent from the DOM entirely.
    expect(queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the offspring-count hint in the stage area", () => {
    const { getByRole } = render(<App />);
    expect(getByRole("list", { name: /crosses/i })).toHaveTextContent(
      /Each cross will produce 5–20 offspring\./i,
    );
  });

  it("shows the cross prompt pill once both parents are selected", () => {
    const { getByRole } = render(<App />);
    selectBothParents(getByRole);
    expect(getByRole("status")).toHaveTextContent("Click Cross Plants to see their offspring");
  });

  it("renders the status pill as a live region (aria-live=polite) once shown", () => {
    const { getByRole } = render(<App />);
    selectBothParents(getByRole);
    expect(getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("shows the fungus-active prompt pill when the Fungus switch is toggled on before crossing", () => {
    const { getByRole } = render(<App />);
    selectBothParents(getByRole);
    fireEvent.click(getByRole("switch", { name: "Fungus" }));
    expect(getByRole("status")).toHaveTextContent(
      "Cross plants to see their offspring · Fungus active",
    );
  });

  it("shows the crosses/offspring stats pill after a cross", () => {
    const { getByRole } = render(<App rng={seededRandom("state2")} />);
    selectBothParents(getByRole);
    fireEvent.click(getByRole("button", { name: "Cross Plants" }));
    expect(getByRole("status")).toHaveTextContent(/Crosses:\s*1\s*·\s*Offspring:\s*\d+/);
  });

  // Fungus must be toggled on before the first cross (the switch locks afterward).
  it("appends Fungus active to the stats pill when fungus is on for a cross", () => {
    const { getByRole } = render(<App rng={seededRandom("state2f")} />);
    selectBothParents(getByRole);
    fireEvent.click(getByRole("switch", { name: "Fungus" }));
    fireEvent.click(getByRole("button", { name: "Cross Plants" }));
    expect(getByRole("status")).toHaveTextContent(
      /Crosses:\s*1\s*·\s*Offspring:\s*\d+\s*·\s*Fungus active/,
    );
  });

  // Selecting a parent locks nothing yet; crossing replaces the selects with chips.
  it("replaces the parent selectors with chips after the first cross", () => {
    const { getByRole, queryByRole, getByText } = render(<App rng={seededRandom("lock")} />);
    selectBothParents(getByRole);
    expect(getByRole("button", { name: /Parent 1/i })).not.toBeDisabled(); // selectable before crossing
    fireEvent.click(getByRole("button", { name: "Cross Plants" }));
    // Selects → static chips: no interactive triggers remain, the chosen varieties show as text.
    expect(queryByRole("button", { name: /Parent 1/i })).not.toBeInTheDocument();
    expect(queryByRole("button", { name: /Parent 2/i })).not.toBeInTheDocument();
    expect(getByText("Wild W1")).toBeInTheDocument();
    expect(getByText("Cavendish C1")).toBeInTheDocument();
  });

  // ---- Fungus switch trial-state semantics ----

  it("toggles the Fungus switch only with both parents and no crosses, logging each change", () => {
    const { getByRole, queryByRole } = render(<App />);

    // Switch disabled; clicking is gated — fungusOn stays false, so the pill (which renders only
    // from real state) stays absent. (The DOM checkbox can't be asserted here: a gated click
    // doesn't re-render, so React never re-syncs the controlled input.)
    const sw0 = getByRole("switch", { name: "Fungus" });
    expect(sw0).toBeDisabled();
    fireEvent.click(sw0);
    expect(queryByRole("status")).not.toBeInTheDocument();

    selectBothParents(getByRole);
    expect(getByRole("switch", { name: "Fungus" })).not.toBeDisabled();

    log.mockReset();
    fireEvent.click(getByRole("switch", { name: "Fungus" })); // on
    expect(getByRole("status")).toHaveTextContent("Fungus active");
    expect(getByRole("switch", { name: "Fungus" })).toBeChecked();
    fireEvent.click(getByRole("switch", { name: "Fungus" })); // off
    expect(getByRole("status")).toHaveTextContent("Click Cross Plants to see their offspring");
    expect(getByRole("switch", { name: "Fungus" })).not.toBeChecked();
    fireEvent.click(getByRole("switch", { name: "Fungus" })); // on
    expect(getByRole("switch", { name: "Fungus" })).toBeChecked();

    const fungusValues = log.mock.calls
      .filter((c) => c[0] === "fungus_set")
      .map((c) => (c[1] as { value: boolean }).value);
    expect(fungusValues).toEqual([true, false, true]);
  });

  it("locks the Fungus switch after the first cross and freezes fungusOn", () => {
    const { getByRole } = render(<App rng={seededRandom("t6-lock")} />);
    selectBothParents(getByRole);
    fireEvent.click(getByRole("switch", { name: "Fungus" })); // on, before crossing
    fireEvent.click(getByRole("button", { name: "Cross Plants" }));

    const sw = getByRole("switch", { name: "Fungus" });
    expect(sw).toBeDisabled();
    expect(sw).toBeChecked();
    expect(getByRole("status")).toHaveTextContent("Fungus active");

    // Toggling the locked switch is a no-op (the gated handler is the last guard): fungusOn stays
    // true, so the pill still reads "Fungus active". (jsdom doesn't re-render the no-op, so the
    // DOM checkbox can't be re-asserted here.)
    fireEvent.click(sw);
    expect(getByRole("status")).toHaveTextContent("Fungus active");
    expect(getByRole("switch", { name: "Fungus" })).toBeDisabled();
  });

  it("keeps the Fungus lock through subsequent crosses up to the cap", () => {
    const { getByRole, container } = render(<App rng={seededRandom("t6-cap")} />);
    selectBothParents(getByRole);
    fireEvent.click(getByRole("switch", { name: "Fungus" })); // on
    for (let i = 0; i < 6; i++) {
      fireEvent.click(getByRole("button", { name: "Cross Plants" }));
    }
    expect(getByRole("switch", { name: "Fungus" })).toBeDisabled();
    expect(getByRole("switch", { name: "Fungus" })).toBeChecked();
    expect(getByRole("button", { name: "Cross Plants" })).toBeDisabled(); // at MAX_CROSSES
    // At the cap two role="status" elements exist (pill + grid max-placeholder); target the pill.
    expect(container.querySelector(".status-pill")).toHaveTextContent("Fungus active");
  });

  it("Reset Trial clears fungusOn and releases the lock", () => {
    const { getByRole } = render(<App rng={seededRandom("t6-reset")} />);
    selectBothParents(getByRole);
    fireEvent.click(getByRole("switch", { name: "Fungus" })); // on
    fireEvent.click(getByRole("button", { name: "Cross Plants" }));

    fireEvent.click(getByRole("button", { name: "Reset Trial" }));
    expect(getByRole("switch", { name: "Fungus" })).not.toBeChecked();

    // Re-selecting parents proves the cross-lock was released and fungus is back to off.
    selectBothParents(getByRole);
    const sw = getByRole("switch", { name: "Fungus" });
    expect(sw).not.toBeDisabled();
    expect(sw).not.toBeChecked();
    expect(getByRole("status")).toHaveTextContent("Click Cross Plants to see their offspring");
  });

  // ---- Reset Trial ----
  // The "no parents but fungusOn=true → Reset enabled" case isn't UI-reachable: the shared
  // <Select> ignores null clears and onSetFungus requires both parents, so fungusOn can never be
  // true with fewer than two parents. The fungusOn term in canReset is defensive only.

  it("Reset clears both selected parents and unlocks the selectors", () => {
    const { getByRole, queryByRole } = render(<App />);
    selectBothParents(getByRole);
    fireEvent.click(getByRole("button", { name: "Reset Trial" }));
    expect(getByRole("button", { name: /Parent 1/i })).toHaveTextContent("Select…");
    expect(getByRole("button", { name: /Parent 2/i })).toHaveTextContent("Select…");
    expect(getByRole("button", { name: /Parent 1/i })).not.toBeDisabled();
    expect(queryByRole("status")).not.toBeInTheDocument();
  });

  it("Reset after a cross clears the offspring, unlocks the selectors, and releases the Fungus lock", () => {
    const { getByRole, queryByRole } = render(<App rng={seededRandom("t7-cross")} />);
    selectBothParents(getByRole);
    fireEvent.click(getByRole("button", { name: "Cross Plants" }));
    expect(queryByRole("button", { name: /Parent 1/i })).not.toBeInTheDocument(); // locked → chip

    fireEvent.click(getByRole("button", { name: "Reset Trial" }));
    expect(queryByRole("status")).not.toBeInTheDocument(); // crosses + pill cleared
    expect(getByRole("button", { name: /Parent 1/i })).not.toBeDisabled(); // selectors re-open

    // Fungus lock released: re-selecting parents makes the switch interactable again.
    selectBothParents(getByRole);
    expect(getByRole("switch", { name: "Fungus" })).not.toBeDisabled();
  });

  it("Reset returns fungusOn to false", () => {
    const { getByRole } = render(<App />);
    selectBothParents(getByRole);
    fireEvent.click(getByRole("switch", { name: "Fungus" })); // on
    expect(getByRole("status")).toHaveTextContent("Fungus active");

    fireEvent.click(getByRole("button", { name: "Reset Trial" }));
    selectBothParents(getByRole); // re-select to observe the (now off) fungus state
    expect(getByRole("status")).toHaveTextContent("Click Cross Plants to see their offspring");
    expect(getByRole("switch", { name: "Fungus" })).not.toBeChecked();
  });

  it("Reset is enabled with a single parent selected and clears it", () => {
    const { getByRole } = render(<App />);
    selectParent(getByRole, /Parent 1/i, "Wild W1");
    expect(getByRole("button", { name: "Reset Trial" })).not.toBeDisabled();

    fireEvent.click(getByRole("button", { name: "Reset Trial" }));
    expect(getByRole("button", { name: /Parent 1/i })).toHaveTextContent("Select…");
    expect(getByRole("button", { name: "Reset Trial" })).toBeDisabled(); // back to empty trial
  });

  it("Reset is disabled and emits nothing from a fully empty trial", () => {
    const { getByRole } = render(<App />);
    const reset = getByRole("button", { name: "Reset Trial" });
    expect(reset).toBeDisabled();

    log.mockReset();
    fireEvent.click(reset);
    expect(log).not.toHaveBeenCalledWith("reset_trial_pressed", expect.anything());
  });

  // ---- Offspring grid ----

  it("exposes the offspring grid as a list named Crosses", () => {
    const { getByRole } = render(<App />);
    expect(getByRole("list", { name: /crosses/i })).toBeInTheDocument();
  });

  it("shows only the placeholder hint (no fungus marker) with zero crosses and fungus off", () => {
    const { getByRole, queryByText } = render(<App />);
    expect(getByRole("list", { name: /crosses/i })).toHaveTextContent(
      "Each cross will produce 5–20 offspring.",
    );
    expect(queryByText("Fungus introduced")).not.toBeInTheDocument();
  });

  it("renders the 'Fungus introduced' marker above the placeholder when fungus is on before crossing", () => {
    const { getByRole, getByText } = render(<App />);
    selectBothParents(getByRole);
    fireEvent.click(getByRole("switch", { name: "Fungus" })); // on, no crosses yet
    expect(getByRole("list", { name: /crosses/i })).toHaveTextContent(
      "Each cross will produce 5–20 offspring.",
    );
    expect(getByText("Fungus introduced")).toBeInTheDocument();
  });

  it("renders one cross row labelled A1 with 5–20 plants after a cross", () => {
    const { getByRole, getAllByRole, container } = render(<App rng={seededRandom("t8-one")} />);
    selectBothParents(getByRole);
    fireEvent.click(getByRole("button", { name: "Cross Plants" }));
    const rows = getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("A1");
    const plants = container.querySelectorAll(".offspring-plant");
    expect(plants.length).toBeGreaterThanOrEqual(5);
    expect(plants.length).toBeLessThanOrEqual(20);
  });

  it("accumulates rows A1, A2, A3 in order across three crosses", () => {
    const { getByRole, getAllByRole } = render(<App rng={seededRandom("t8-three")} />);
    selectBothParents(getByRole);
    for (let i = 0; i < 3; i++) fireEvent.click(getByRole("button", { name: "Cross Plants" }));
    const rows = getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("A1");
    expect(rows[1]).toHaveTextContent("A2");
    expect(rows[2]).toHaveTextContent("A3");
  });

  it("renders the Fungus marker above the first cross row (DOM order)", () => {
    const { getByRole, getByText } = render(<App rng={seededRandom("t8-marker")} />);
    selectBothParents(getByRole);
    fireEvent.click(getByRole("switch", { name: "Fungus" })); // on
    fireEvent.click(getByRole("button", { name: "Cross Plants" }));
    const marker = getByText("Fungus introduced");
    const row = getByRole("listitem");
    expect(marker.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the max-crosses placeholder and disables Cross Plants + Fungus at the cap", () => {
    const { getByRole, getAllByRole } = render(<App rng={seededRandom("t8-cap")} />);
    selectBothParents(getByRole);
    for (let i = 0; i < 6; i++) fireEvent.click(getByRole("button", { name: "Cross Plants" }));
    expect(getAllByRole("listitem")).toHaveLength(6);
    const grid = getByRole("list", { name: /crosses/i });
    expect(within(grid).getByRole("status")).toHaveTextContent("Max number of crosses reached");
    expect(getByRole("button", { name: "Cross Plants" })).toBeDisabled();
    expect(getByRole("switch", { name: "Fungus" })).toBeDisabled();
  });

  it("renders every plant infected when an all-rr cross is made under fungus", () => {
    // Constant rng 0.7 → W1 draws r (index 1), so every offspring is rr (non-resistant).
    const { getByRole, container } = render(<App rng={() => 0.7} />);
    selectBothParents(getByRole); // Wild W1 × Cavendish C1
    fireEvent.click(getByRole("switch", { name: "Fungus" })); // on
    fireEvent.click(getByRole("button", { name: "Cross Plants" }));
    const plants = container.querySelectorAll(".offspring-plant");
    expect(plants.length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".offspring-plant.infected")).toHaveLength(plants.length);
  });

  it("never infects resistant offspring even under fungus", () => {
    // Constant rng 0.2 → W1 draws R (index 0), so every offspring is Rr (resistant).
    const { getByRole, container } = render(<App rng={() => 0.2} />);
    selectBothParents(getByRole);
    fireEvent.click(getByRole("switch", { name: "Fungus" })); // on
    fireEvent.click(getByRole("button", { name: "Cross Plants" }));
    expect(container.querySelectorAll(".offspring-plant").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".offspring-plant.infected")).toHaveLength(0);
  });

  // Regression: fungus is all-or-nothing, so there is never a between-row "introduced after" marker.
  it("never renders a between-row 'introduced after' marker", () => {
    const { getByRole, queryByText } = render(<App rng={seededRandom("t8-regression")} />);
    selectBothParents(getByRole);
    fireEvent.click(getByRole("switch", { name: "Fungus" })); // on
    for (let i = 0; i < 6; i++) fireEvent.click(getByRole("button", { name: "Cross Plants" }));
    expect(queryByText(/introduced after/i)).not.toBeInTheDocument();
  });

  it("gives each cross row an aria-label describing its counts", () => {
    const { getByRole, getAllByRole } = render(<App rng={seededRandom("t8-aria")} />);
    selectBothParents(getByRole);
    for (let i = 0; i < 2; i++) fireEvent.click(getByRole("button", { name: "Cross Plants" }));
    for (const row of getAllByRole("listitem")) {
      expect(row.getAttribute("aria-label")).toMatch(
        /^Cross \d+, \d+ offspring, \d+ healthy, \d+ infected$/,
      );
    }
  });

  it("scrolls the offspring grid to the bottom after a cross", () => {
    const { getByRole, container } = render(<App rng={seededRandom("scroll")} />);
    selectBothParents(getByRole);
    const grid = container.querySelector(".offspring-grid") as HTMLElement;
    // jsdom has no layout (scrollHeight is 0), so simulate an overflowing grid.
    Object.defineProperty(grid, "scrollHeight", { value: 500, configurable: true });
    grid.scrollTop = 0;
    fireEvent.click(getByRole("button", { name: "Cross Plants" }));
    expect(grid.scrollTop).toBe(500);
  });
});

describe("Bananas App — AP saved state", () => {
  // A locked trial: two parents chosen and one cross of two plants recorded.
  const savedState: TrialState = {
    p1: "wild-w1",
    p2: "cavendish-c1",
    locked: true,
    fungusOn: false,
    crosses: [
      [
        { genotype: "Rr", isResistant: true, infected: false },
        { genotype: "rr", isResistant: false, infected: false },
      ],
    ],
  };

  it("renders the default empty trial when no init message arrives (standalone)", () => {
    const { getByLabelText, queryByRole } = render(<App />);
    expect(getByLabelText("Parent 1")).toBeInTheDocument(); // interactive selector, not a chip
    expect(queryByRole("status")).not.toBeInTheDocument();
  });

  it("restores parents + crosses from a runtime init message's interactiveState", () => {
    useInitMessage.mockReturnValue({ mode: "runtime", interactiveState: savedState });
    const { getByText, getByRole, getAllByRole, queryByRole } = render(<App />);
    // Locked → parents shown as static chips, not selectors.
    expect(queryByRole("button", { name: /Parent 1/i })).not.toBeInTheDocument();
    expect(getByText("Wild W1")).toBeInTheDocument();
    expect(getByText("Cavendish C1")).toBeInTheDocument();
    // The recorded cross is restored verbatim.
    expect(getAllByRole("listitem")).toHaveLength(1);
    expect(getByRole("status")).toHaveTextContent(/Crosses:\s*1\s*·\s*Offspring:\s*2/);
  });

  it("does NOT restore when the init message has interactiveState: null (first session)", () => {
    useInitMessage.mockReturnValue({ mode: "runtime", interactiveState: null });
    const { getByLabelText, queryByRole } = render(<App />);
    expect(getByLabelText("Parent 1")).toBeInTheDocument(); // empty → interactive selector
    expect(queryByRole("status")).not.toBeInTheDocument();
  });

  it("pushes state via setInteractiveState on mount and on every trial change", () => {
    const { getByRole } = render(<App />);
    expect(setInteractiveState).toHaveBeenCalled(); // initial empty trial
    setInteractiveState.mockClear();

    selectParent(getByRole, /Parent 1/i, "Wild W1");
    expect(setInteractiveState).toHaveBeenCalled();
    const lastArg = setInteractiveState.mock.calls.at(-1)?.[0] as TrialState;
    expect(lastArg.p1).toBe("wild-w1");
  });

  it("registers a beforeunload listener once there's progress (standalone)", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const { getByRole } = render(<App />);
    expect(addSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
    selectParent(getByRole, /Parent 1/i, "Wild W1");
    expect(addSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    addSpy.mockRestore();
  });

  it("does NOT register a beforeunload listener when embedded (AP persists progress)", () => {
    useInitMessage.mockReturnValue({ mode: "runtime", interactiveState: null });
    const addSpy = vi.spyOn(window, "addEventListener");
    const { getByRole } = render(<App />);
    selectParent(getByRole, /Parent 1/i, "Wild W1");
    expect(addSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
    addSpy.mockRestore();
  });
});
