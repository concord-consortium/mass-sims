import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The shared <Button> imports useLogEvent internally, so the log() transport — not the hook — is
// the seam a sim test can mock (this also captures the FungusSwitch's events). vi.hoisted so the
// mock exists when vi.mock runs.
const { log } = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("@concord-consortium/lara-interactive-api", () => ({ log }));

import type { OffspringPlant } from "../model/genetics";
import { type RootStoreInstance, RootStoreProvider } from "../stores/root-store";
import { createTestStore } from "../stores/test-helpers";
import { ControlBar } from "./control-bar";

function plant(infected = false): OffspringPlant {
  return { genotype: infected ? "rr" : "Rr", isResistant: !infected, infected };
}

function renderBar(store: RootStoreInstance = createTestStore()) {
  return render(
    <RootStoreProvider store={store}>
      <ControlBar />
    </RootStoreProvider>,
  );
}

// Canonical trial states for the control-enable matrix.
const empty = () => createTestStore(); // State 0: no parents, no crosses
const bothParents = () => createTestStore({ trial: { p1: "wild-w1", p2: "cavendish-c1" } }); // State 1
const bothParentsFungus = () =>
  createTestStore({ trial: { p1: "wild-w1", p2: "cavendish-c1", fungusOn: true } }); // State 1f
const lockedWithCross = () =>
  createTestStore({
    trial: { p1: "wild-w1", p2: "cavendish-c1", locked: true, crosses: [[plant()]] },
  }); // State 2

describe("ControlBar", () => {
  it("renders the Fungus switch plus Cross Plants and Reset Trial buttons", () => {
    const { getByRole } = renderBar();
    expect(getByRole("switch", { name: "Fungus" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Cross Plants" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Reset Trial" })).toBeInTheDocument();
  });

  it("renders the controls left-to-right as Fungus, Cross Plants, Reset Trial", () => {
    const { getByRole } = renderBar();
    const fungus = getByRole("switch", { name: "Fungus" });
    const cross = getByRole("button", { name: "Cross Plants" });
    const reset = getByRole("button", { name: "Reset Trial" });
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
    expect(fungus.compareDocumentPosition(cross) & FOLLOWING).toBeTruthy();
    expect(cross.compareDocumentPosition(reset) & FOLLOWING).toBeTruthy();
  });

  it("disables Cross Plants when canCross is false and crosses into the store + logs when pressed", () => {
    // Disabled with only one parent (canCross false).
    const onePanel = renderBar(createTestStore({ trial: { p1: "wild-w1" } }));
    expect(onePanel.getByRole("button", { name: "Cross Plants" })).toBeDisabled();
    onePanel.unmount();

    // Enabled with both parents; pressing drives trial.crossPlants and logs.
    const store = bothParents();
    const { getByRole } = renderBar(store);
    const button = getByRole("button", { name: "Cross Plants" });
    expect(button).not.toBeDisabled();
    log.mockReset();
    fireEvent.click(button);
    expect(store.activeTrial.crosses).toHaveLength(1);
    expect(log).toHaveBeenCalledWith("cross_plants_pressed", undefined);
  });

  it("disables Reset Trial when canReset is false and resets the store + logs when pressed", () => {
    const emptyPanel = renderBar(empty());
    expect(emptyPanel.getByRole("button", { name: "Reset Trial" })).toBeDisabled();
    emptyPanel.unmount();

    const store = lockedWithCross();
    const { getByRole } = renderBar(store);
    const button = getByRole("button", { name: "Reset Trial" });
    expect(button).not.toBeDisabled();
    log.mockReset();
    fireEvent.click(button);
    expect(store.activeTrial.crosses).toHaveLength(0);
    expect(store.activeTrial.canReset).toBe(false);
    expect(log).toHaveBeenCalledWith("reset_trial_pressed", undefined);
  });

  it("reflects fungusOn on the switch and drives trial.setFungus + logs on toggle", () => {
    const store = bothParents();
    const { getByRole } = renderBar(store);
    const switchEl = getByRole("switch", { name: "Fungus" });
    expect(switchEl).not.toBeChecked();

    log.mockReset();
    fireEvent.click(switchEl);
    expect(store.activeTrial.fungusOn).toBe(true);
    expect(getByRole("switch", { name: "Fungus" })).toBeChecked();
    expect(log).toHaveBeenCalledWith("fungus_set", expect.objectContaining({ value: true }));

    fireEvent.click(getByRole("switch", { name: "Fungus" }));
    expect(store.activeTrial.fungusOn).toBe(false);
  });
});

// The Fungus switch's disabled state must equal `trial.isFungusLocked` across the four canonical
// states.
describe("ControlBar — Fungus enable/disable matrix", () => {
  it("State 0 (no parents, no crosses): disabled", () => {
    expect(renderBar(empty()).getByRole("switch", { name: "Fungus" })).toBeDisabled();
  });

  it("State 1 (both parents, no crosses, fungus off): enabled", () => {
    expect(renderBar(bothParents()).getByRole("switch", { name: "Fungus" })).not.toBeDisabled();
  });

  it("State 1f (both parents, no crosses, fungus on): enabled", () => {
    expect(
      renderBar(bothParentsFungus()).getByRole("switch", { name: "Fungus" }),
    ).not.toBeDisabled();
  });

  it("State 2 (both parents, ≥ 1 cross): disabled", () => {
    expect(renderBar(lockedWithCross()).getByRole("switch", { name: "Fungus" })).toBeDisabled();
  });
});

describe("ControlBar — concurrent clicks", () => {
  it("produces exactly two crosses when Cross Plants is clicked twice in succession", () => {
    const store = bothParents();
    const { getByRole } = renderBar(store);
    const button = getByRole("button", { name: "Cross Plants" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(store.activeTrial.crosses).toHaveLength(2);
  });
});
