import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { applyTest, makeEmptyTrial, markHandled } from "../model/trial";
import { EvidencePanel } from "./evidence-panel";

describe("EvidencePanel", () => {
  it("says nothing has been observed yet on a fresh trial", () => {
    const { getByText } = render(<EvidencePanel trial={makeEmptyTrial()} />);
    expect(getByText(/nothing observed yet/i)).toBeInTheDocument();
  });

  it("lists a handling note and a test result in full", () => {
    let trial = markHandled(makeEmptyTrial(), "B");
    trial = applyTest(trial, "B", "water", null);
    const { getByText } = render(<EvidencePanel trial={trial} />);
    // Lump B is the sea salt.
    expect(getByText(/cube-shaped crystals/i)).toBeInTheDocument();
    expect(getByText(/shrinks away to nothing/i)).toBeInTheDocument();
  });

  it("names the test and its setting alongside the observation", () => {
    const trial = applyTest(makeEmptyTrial(), "A", "bath", "80");
    const { getByText } = render(<EvidencePanel trial={trial} />);
    expect(getByText(/warm bath, 80 °C/i)).toBeInTheDocument();
  });
});
