import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The shared Select/Button import useLogEvent (→ lara's log transport); mock it so mounting the
// panel's controls doesn't reach the real lara-interactive-api in jsdom.
const { log } = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("@concord-consortium/lara-interactive-api", () => ({ log }));

import { createRootStore, RootStoreProvider } from "../stores/root-store";
import { SimulationPanel } from "./simulation-panel";

// Panel-level composition. The per-component behavior is covered by air-mass-selectors.test.tsx,
// control-bar.test.tsx, and map-stage.test.tsx; this asserts the panel wires the store + composes
// the three regions in order.
function renderPanel() {
  const store = createRootStore();
  const utils = render(
    <RootStoreProvider store={store}>
      <SimulationPanel />
    </RootStoreProvider>,
  );
  return { store, ...utils };
}

describe("SimulationPanel (composition)", () => {
  it("shows the active-trial letter in the badge", () => {
    const { container, store } = renderPanel();
    const badge = container.querySelector(".active-trial-badge");
    expect(badge).toHaveTextContent(store.ui.selectedTrialLetter);
  });

  it("composes the air-mass selectors, map stage, and control bar in that order", () => {
    const { container } = renderPanel();
    const selectors = container.querySelector(".nor-air-mass-selectors");
    const stage = container.querySelector(".nor-stage");
    const controlBar = container.querySelector(".control-bar");
    expect(selectors).toBeInTheDocument();
    expect(stage).toBeInTheDocument();
    expect(controlBar).toBeInTheDocument();
    // DOM order: selectors → map stage → control bar (the panel's flex column).
    expect(selectors?.compareDocumentPosition(stage as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(stage?.compareDocumentPosition(controlBar as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("threads the map-view state: toggling the switch flips the stage's basemap", () => {
    const { container, getByRole } = renderPanel();
    const stage = container.querySelector(".nor-stage");
    const toggle = getByRole("switch", { name: "Map view: Street" });
    expect(stage).toHaveAttribute("data-map-view", "street");
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    expect(stage).toHaveAttribute("data-map-view", "satellite");
    expect(getByRole("switch", { name: "Map view: Satellite" })).toBeChecked();

    fireEvent.click(toggle);
    expect(stage).toHaveAttribute("data-map-view", "street");
  });
});
