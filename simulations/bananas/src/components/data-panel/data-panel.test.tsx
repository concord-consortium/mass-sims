import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// BananasDataPanel itself is pure, but the region test renders the whole <App />, which pulls in
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
import { emptyTrial } from "../../model/trial";
import {
  LEGEND_DASH,
  LEGEND_HEALTHY,
  LEGEND_INFECTED,
  PHENOTYPES_TITLE,
  RESISTANCE_TITLE_LONG,
} from "./constants";
import { BananasDataPanel } from "./data-panel";

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
    const { container } = render(<BananasDataPanel trial={emptyTrial()} />);
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
    const { container, getAllByText } = render(<BananasDataPanel trial={emptyTrial()} />);
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
    const { getByRole } = render(<BananasDataPanel trial={emptyTrial()} />);
    expect(getByRole("heading", { level: 3, name: PHENOTYPES_TITLE })).toBeInTheDocument();
    expect(getByRole("heading", { level: 3, name: RESISTANCE_TITLE_LONG })).toBeInTheDocument();
  });

  it("exposes both charts as labeled images with their empty-state descriptions", () => {
    const { getByRole } = render(<BananasDataPanel trial={emptyTrial()} />);
    expect(getByRole("img", { name: "Offspring phenotypes: no data" })).toBeInTheDocument();
    expect(
      getByRole("img", { name: "Fungus resistance over crosses: no data" }),
    ).toBeInTheDocument();
  });

  it("orders every legend Healthy → Infected in the DOM (reading-order convention)", () => {
    const { getAllByText } = render(<BananasDataPanel trial={emptyTrial()} />);
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
    const { container } = render(<BananasDataPanel trial={emptyTrial()} />);
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
