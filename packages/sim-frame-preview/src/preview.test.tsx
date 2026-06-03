import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Preview } from "./preview";

describe("Preview", () => {
  it("renders a SimulationFrame for each of the four target widths", () => {
    const { getAllByRole } = render(<Preview />);
    // Each frame contributes a Trials region; four widths → four Trials regions.
    expect(getAllByRole("region", { name: "Trials" })).toHaveLength(4);
  });
});
