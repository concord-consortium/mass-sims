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
    let trial = markExamined(makeEmptyTrial(), "2");
    trial = applyTest(trial, "2", "water", null);
    const { getByText } = render(<EvidencePanel trial={trial} />);
    // Lump 2 is the sea salt.
    expect(getByText(/cube-shaped crystals/i)).toBeInTheDocument();
    expect(getByText(/shrinks away to nothing/i)).toBeInTheDocument();
  });

  it("names the test and its setting alongside the observation", () => {
    const trial = applyTest(makeEmptyTrial(), "1", "lamp", "day");
    const { getByText } = render(<EvidencePanel trial={trial} />);
    expect(getByText(/uv lamp, a day/i)).toBeInTheDocument();
  });

  it("records the mass before and after the test", () => {
    // Lump 2 is the sea salt, which dissolves to nothing; lump 4 is palm oil, which melts but
    // keeps all its mass.
    let trial = applyTest(makeEmptyTrial(), "2", "water", null);
    trial = applyTest(trial, "4", "bath", null);
    const { getByText } = render(<EvidencePanel trial={trial} />);
    expect(getByText(/67\.3 g before the test, 0\.0 g after/)).toBeInTheDocument();
    expect(getByText(/35\.6 g before the test, 35\.6 g after/)).toBeInTheDocument();
  });

  it("holds back the outcome and the mass after until the test has finished running", () => {
    const trial = applyTest(makeEmptyTrial(), "2", "water", null);
    const { getByText, queryByText } = render(<EvidencePanel trial={trial} runningLump="2" />);
    expect(getByText(/67\.3 g before the test\.$/)).toBeInTheDocument();
    expect(queryByText(/g after/)).not.toBeInTheDocument();
    expect(getByText(/running…/i)).toBeInTheDocument();
    expect(queryByText(/shrinks away/i)).not.toBeInTheDocument();
  });
});
