import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { applyTest, makeEmptyTrial } from "../model/trial";
import { LumpRow } from "./lump-row";

const noop = () => undefined;

describe("LumpRow", () => {
  it("shows all five lumps", () => {
    const { getAllByRole } = render(
      <LumpRow trial={makeEmptyTrial()} onHandle={noop} onWaft={noop} runningLump={null} />,
    );
    // Each station offers handle and waft, so ten buttons for five lumps.
    expect(getAllByRole("button", { name: /handle lump/i })).toHaveLength(5);
    expect(getAllByRole("button", { name: /waft lump/i })).toHaveLength(5);
  });

  it("reports which lump was handled", () => {
    const onHandle = vi.fn();
    const { getByRole } = render(
      <LumpRow trial={makeEmptyTrial()} onHandle={onHandle} onWaft={noop} runningLump={null} />,
    );
    fireEvent.click(getByRole("button", { name: /handle lump c/i }));
    expect(onHandle).toHaveBeenCalledWith("C");
  });

  it("keeps handling and wafting available on a spent lump", () => {
    const trial = applyTest(makeEmptyTrial(), "C", "water", null);
    const { getByRole } = render(
      <LumpRow trial={trial} onHandle={noop} onWaft={noop} runningLump={null} />,
    );
    // The spent lump is the one case where a free action still has to work.
    expect(getByRole("button", { name: /handle lump c/i })).toBeEnabled();
    expect(getByRole("button", { name: /waft lump c/i })).toBeEnabled();
  });

  it("captions a spent lump with what was done to it", () => {
    const trial = applyTest(makeEmptyTrial(), "E", "vinegar", null);
    const { getByText } = render(
      <LumpRow trial={trial} onHandle={noop} onWaft={noop} runningLump={null} />,
    );
    // Lump E is the seashell, so vinegar fizzes.
    expect(getByText(/steady stream of small bubbles/i)).toBeInTheDocument();
  });
});
