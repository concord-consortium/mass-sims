import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { applyTest, makeEmptyTrial } from "../model/trial";
import { TestLab } from "./test-lab";

const base = {
  trial: makeEmptyTrial(),
  test: "vinegar" as const,
  setting: null,
  running: false,
  message: null,
};

describe("TestLab", () => {
  it("asks for a lump when the bench is empty", () => {
    const { getByText } = render(<TestLab {...base} selectedLump={null} />);
    expect(getByText(/pick a lump from the tray/i)).toBeInTheDocument();
  });

  it("names the apparatus for the chosen test", () => {
    const { getByText, rerender } = render(<TestLab {...base} selectedLump="A" />);
    expect(getByText(/tube of vinegar/i)).toBeInTheDocument();
    rerender(<TestLab {...base} selectedLump="A" test="lamp" setting="fortnight" />);
    expect(getByText(/uv lamp, two weeks/i)).toBeInTheDocument();
  });

  it("keeps a spent lump on the bench", () => {
    const trial = applyTest(makeEmptyTrial(), "D", "lamp", "day");
    const { getByText } = render(<TestLab {...base} trial={trial} selectedLump="D" />);
    expect(getByText("Lump D")).toBeInTheDocument();
  });

  it("shows the latest observation", () => {
    const { getByText } = render(
      <TestLab {...base} selectedLump="A" message="A sharp, rancid smell." />,
    );
    expect(getByText("A sharp, rancid smell.")).toBeInTheDocument();
  });
});
