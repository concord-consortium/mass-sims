import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { applyTest, makeEmptyTrial } from "../model/trial";
import { TrialCardBody } from "./trial-card-body";

describe("TrialCardBody", () => {
  it("lists each tested sample behind a picture of how its test left it", () => {
    // Sample 2 is the sea salt, which the water dissolves.
    const trial = applyTest(makeEmptyTrial(), "2", "water");
    const { container, getByText } = render(<TrialCardBody trial={trial} />);
    expect(getByText(/sample 2 · water/i)).toBeInTheDocument();
    expect(container.querySelector(".card-row .card-blob")).toHaveClass("visual-dissolving");
  });
});
