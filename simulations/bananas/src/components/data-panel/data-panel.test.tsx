import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// BananasDataPanel reads the store, but the region test renders the whole <App />, which pulls in
// lara-interactive-api. Mock that surface; standalone by default.
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

import { App } from "../../app";
import type { OffspringPlant } from "../../model/genetics";
import { type RootStoreInstance, RootStoreProvider } from "../../stores/root-store";
import { createTestStore } from "../../stores/test-helpers";
import { LEGEND_DASH, LEGEND_HEALTHY, LEGEND_INFECTED } from "./constants";
import { BananasDataPanel } from "./data-panel";

function plant(infected: boolean): OffspringPlant {
  return { genotype: infected ? "rr" : "Rr", isResistant: !infected, infected };
}

function storeWithCrosses(crosses: OffspringPlant[][], selectedCross: number | null = null) {
  return createTestStore({
    trial: { p1: "wild-w1", p2: "cavendish-c1", locked: true, crosses },
    ui: { selectedCrossByTrial: selectedCross == null ? {} : { A: selectedCross } },
  });
}

function renderPanel(
  store: RootStoreInstance = createTestStore(),
  onPillChipClick: () => void = vi.fn(),
  onPillCloseClick: () => void = vi.fn(),
) {
  return render(
    <RootStoreProvider store={store}>
      <BananasDataPanel onPillChipClick={onPillChipClick} onPillCloseClick={onPillCloseClick} />
    </RootStoreProvider>,
  );
}

beforeEach(() => {
  useInitMessage.mockReturnValue(null);
  log.mockReset();
  setInteractiveState.mockReset();
});

describe("BananasDataPanel — layout", () => {
  it("renders inside the Data slot region when mounted in the App", () => {
    const { getByRole } = render(<App />);
    const dataRegion = getByRole("region", { name: /data/i });
    expect(dataRegion.querySelector(".bananas-data-panel")).toBeInTheDocument();
  });

  it("renders both phenotype legend items with labels and en-dash placeholders", () => {
    const { container } = renderPanel();
    // Scope to the first legend — a second (resistance) legend also reads "Healthy"/"Infected",
    // so an unscoped getByText would match multiple elements.
    const [phenotypesLegend] = container.querySelectorAll(".data-legend");
    expect(phenotypesLegend.textContent).toContain(LEGEND_HEALTHY);
    expect(phenotypesLegend.textContent).toContain(LEGEND_INFECTED);
    // One en-dash placeholder per legend item (Healthy + Infected).
    const pcts = phenotypesLegend.querySelectorAll(".legend-pct");
    expect(pcts).toHaveLength(2);
    for (const pct of pcts) expect(pct.textContent).toBe(LEGEND_DASH);
  });

  it("renders the resistance legend with Healthy + Infected but no percentage placeholders", () => {
    const { container, getAllByText } = renderPanel();
    const legends = container.querySelectorAll(".data-legend");
    expect(legends).toHaveLength(2);
    const resistanceLegend = legends[1];
    // Both labels appear in the second legend...
    expect(getAllByText(LEGEND_HEALTHY)).toHaveLength(2); // one per legend
    expect(getAllByText(LEGEND_INFECTED)).toHaveLength(2);
    expect(resistanceLegend.textContent).toContain(LEGEND_HEALTHY);
    expect(resistanceLegend.textContent).toContain(LEGEND_INFECTED);
    // ...but the resistance legend carries no percentage spans (unlike the phenotypes legend).
    expect(resistanceLegend.querySelectorAll(".legend-pct")).toHaveLength(0);
  });
});

// The locked accessibility guarantees, asserted against the assembled panel.
describe("BananasDataPanel — accessibility", () => {
  it("exposes both sub-section headings as level-3 headings", () => {
    const { getAllByRole } = renderPanel();
    expect(getAllByRole("heading", { level: 3 })).toHaveLength(2);
  });

  it("exposes both charts as labeled images with their empty-state descriptions", () => {
    const { getByRole } = renderPanel();
    expect(getByRole("img", { name: "Offspring phenotypes: no data" })).toBeInTheDocument();
    expect(
      getByRole("img", { name: "Fungus resistance over crosses: no data" }),
    ).toBeInTheDocument();
  });

  it("orders every legend Healthy → Infected in the DOM (reading-order convention)", () => {
    const { getAllByText } = renderPanel();
    const healthy = getAllByText(LEGEND_HEALTHY);
    const infected = getAllByText(LEGEND_INFECTED);
    expect(healthy).toHaveLength(2);
    expect(infected).toHaveLength(2);
    // In each legend (phenotypes then resistance), Healthy precedes Infected in document order.
    for (let i = 0; i < healthy.length; i++) {
      expect(
        healthy[i].compareDocumentPosition(infected[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("gives every legend swatch a semantic color modifier class (not color-only encoding)", () => {
    const { container } = renderPanel();
    for (const cls of [
      ".phenotypes-swatch--healthy",
      ".phenotypes-swatch--infected",
      ".resistance-swatch--healthy",
      ".resistance-swatch--infected",
    ]) {
      expect(container.querySelector(cls)).toBeInTheDocument();
    }
  });
});

describe("BananasDataPanel — pie + legend wiring (MAS-12)", () => {
  it("shows en-dash legend placeholders with no crosses", () => {
    const { container } = renderPanel();
    const pcts = container.querySelectorAll(".phenotypes-legend .legend-pct");
    expect(pcts).toHaveLength(2);
    for (const pct of pcts) expect(pct.textContent).toBe(LEGEND_DASH);
  });

  it("fills the legend percentages from the aggregated totals", () => {
    const store = storeWithCrosses([
      [...Array.from({ length: 8 }, () => plant(false)), plant(true), plant(true)], // 8 H, 2 I
    ]);
    const { container } = renderPanel(store);
    const pcts = container.querySelectorAll(".phenotypes-legend .legend-pct");
    expect(pcts[0].textContent).toBe("80%");
    expect(pcts[1].textContent).toBe("20%");
  });

  it("scopes the pie to a single cross when one is selected", () => {
    // Cross 1 is all healthy, cross 2 all infected — selecting cross 1 should show 100% healthy.
    const store = storeWithCrosses(
      [
        [plant(false), plant(false)],
        [plant(true), plant(true)],
      ],
      0,
    );
    const { getByRole } = renderPanel(store);
    expect(
      getByRole("img", { name: "Offspring phenotypes for cross 1: 100% healthy, 0% infected" }),
    ).toBeInTheDocument();
  });
});

describe("BananasDataPanel — filter chip pill (MAS-12)", () => {
  // 3 crosses; the third has 7 plants so the chip reads "A3 (7 offspring)".
  const threeCrosses = (selectedCross: number | null = null) =>
    storeWithCrosses(
      [[plant(false)], [plant(false)], Array.from({ length: 7 }, () => plant(false))],
      selectedCross,
    );

  it("renders the plain 'All Crosses' span with no chip buttons when nothing is selected", () => {
    const { container, getByText } = renderPanel(threeCrosses());
    expect(getByText("All Crosses")).toBeInTheDocument();
    expect(container.querySelector(".pill-chip")).not.toBeInTheDocument();
    expect(container.querySelector(".pill-close")).not.toBeInTheDocument();
  });

  it("renders the chip body and close button for a selected cross", () => {
    const { container, getByRole } = renderPanel(threeCrosses(2));
    expect(getByRole("button", { name: "Scroll to cross A3" })).toBeInTheDocument();
    expect(container.querySelector(".pill-chip")).toHaveTextContent("A3 (7 offspring)");
    expect(container.querySelector(".pill-close")).toBeInTheDocument();
  });

  it("prefixes the chip with the active trial's letter", () => {
    const store = createTestStore({
      trials: { B: { p1: "wild-w1", p2: "cavendish-c1", locked: true, crosses: [[plant(false)]] } },
      ui: { selectedTrialLetter: "B", selectedCrossByTrial: { B: 0 } },
    });
    const { getByRole } = renderPanel(store);
    expect(getByRole("button", { name: "Scroll to cross B1" })).toHaveTextContent(
      "B1 (1 offspring)",
    );
  });

  it("calls onPillChipClick (only) when the chip body is clicked, leaving the selection intact", () => {
    const store = threeCrosses(2);
    const onPillChipClick = vi.fn();
    const onPillCloseClick = vi.fn();
    const { container } = renderPanel(store, onPillChipClick, onPillCloseClick);
    fireEvent.click(container.querySelector(".pill-chip") as HTMLElement);
    expect(onPillChipClick).toHaveBeenCalledTimes(1);
    expect(onPillCloseClick).not.toHaveBeenCalled();
    expect(store.activeCross).toBe(2); // selection unchanged (not cleared)
  });

  it("keeps the chip out of the tab order but leaves the close button focusable", () => {
    // The chip is a non-essential pointer affordance (tabindex=-1); the close button stays a
    // normal keyboard-focusable button, matching the demo.
    const { container } = renderPanel(threeCrosses(2));
    expect(container.querySelector(".pill-chip")).toHaveAttribute("tabindex", "-1");
    expect(container.querySelector(".pill-close")).not.toHaveAttribute("tabindex");
  });

  it("calls onPillCloseClick (only) when the close button is clicked", () => {
    const store = threeCrosses(2);
    const onPillChipClick = vi.fn();
    const onPillCloseClick = vi.fn();
    const { container } = renderPanel(store, onPillChipClick, onPillCloseClick);
    fireEvent.click(container.querySelector(".pill-close") as HTMLElement);
    expect(onPillCloseClick).toHaveBeenCalledTimes(1);
    expect(onPillChipClick).not.toHaveBeenCalled();
  });

  it("labels the close button for screen readers", () => {
    const { getByRole } = renderPanel(threeCrosses(2));
    expect(getByRole("button", { name: "Deselect cross, show all crosses" })).toBeInTheDocument();
  });
});
