import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { applyTest, makeEmptyTrial, markExamined } from "../model/trial";
import { EvidencePanel } from "./evidence-panel";

describe("EvidencePanel", () => {
  it("says nothing has been observed yet on a fresh trial", () => {
    const { getByText } = render(<EvidencePanel trial={makeEmptyTrial()} />);
    expect(getByText(/nothing observed yet/i)).toBeInTheDocument();
  });

  it("lists an examination and a test result in full", () => {
    let trial = markExamined(makeEmptyTrial(), "B");
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

  it("records the mass before and after the test", () => {
    // Lump B is the sea salt, which dissolves to nothing; lump D is palm oil, which melts but
    // keeps all its mass.
    let trial = applyTest(makeEmptyTrial(), "B", "water", null);
    trial = applyTest(trial, "D", "bath", "60");
    const { getByText } = render(<EvidencePanel trial={trial} />);
    expect(getByText(/67\.3 g before the test, 0\.0 g after/)).toBeInTheDocument();
    expect(getByText(/35\.6 g before the test, 35\.6 g after/)).toBeInTheDocument();
  });

  it("holds back the outcome and the mass after until the test has finished running", () => {
    const trial = applyTest(makeEmptyTrial(), "B", "water", null);
    const { getByText, queryByText } = render(<EvidencePanel trial={trial} runningLump="B" />);
    expect(getByText(/67\.3 g before the test\.$/)).toBeInTheDocument();
    expect(queryByText(/g after/)).not.toBeInTheDocument();
    expect(getByText(/running…/i)).toBeInTheDocument();
    expect(queryByText(/shrinks away/i)).not.toBeInTheDocument();
  });
});
