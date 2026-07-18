import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MapStage } from "./map-stage";

// MapStage is pure presentational markup (no store, no shared controls) — render it directly.
describe("MapStage (default state)", () => {
  it("renders the base map as an informative image named by its description", () => {
    const { getByRole } = render(<MapStage />);
    // The map's meaning is carried by the <img> alt (the full verbatim description), not a hidden
    // element — a single, testable a11y mechanism.
    expect(getByRole("img", { name: /Map of the eastern United States/ })).toBeInTheDocument();
  });

  it("renders the compass, four arrows, four pills, and the Boston marker as decorative overlays", () => {
    const { container } = render(<MapStage />);
    const overlays = [
      ...container.querySelectorAll(".nor-arrow, .nor-pill, .nor-boston, .nor-compass"),
    ];
    expect(overlays).toHaveLength(10); // 4 arrows + 4 pills + boston + compass
    expect(overlays.every((o) => o.getAttribute("aria-hidden") === "true")).toBe(true);
  });

  it("renders the four numbered pathway pills with their direction labels", () => {
    const { container } = render(<MapStage />);
    const stage = container.querySelector(".nor-stage") as HTMLElement;
    for (const label of ["N/NW", "W", "S/SE", "NE"]) {
      expect(within(stage).getByText(label)).toBeInTheDocument();
    }
  });
});
