import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { applyTest, makeEmptyTrial } from "../model/trial";
import { LumpTray } from "./lump-tray";

describe("LumpTray", () => {
  it("offers all five lumps to begin with", () => {
    const { getAllByRole } = render(
      <LumpTray trial={makeEmptyTrial()} selectedLump={null} onSelect={() => undefined} />,
    );
    expect(getAllByRole("button")).toHaveLength(5);
  });

  it("reports which lump was picked", () => {
    const onSelect = vi.fn();
    const { getByRole } = render(
      <LumpTray trial={makeEmptyTrial()} selectedLump={null} onSelect={onSelect} />,
    );
    fireEvent.click(getByRole("button", { name: /C/ }));
    expect(onSelect).toHaveBeenCalledWith("C");
  });

  it("drops a lump once its one test has been spent", () => {
    const trial = applyTest(makeEmptyTrial(), "C", "water", null);
    const { getAllByRole, queryByRole } = render(
      <LumpTray trial={trial} selectedLump="C" onSelect={() => undefined} />,
    );
    expect(getAllByRole("button")).toHaveLength(4);
    expect(queryByRole("button", { name: /C/ })).toBeNull();
  });

  it("marks the lump that is on the bench", () => {
    const { getByRole } = render(
      <LumpTray trial={makeEmptyTrial()} selectedLump="B" onSelect={() => undefined} />,
    );
    expect(getByRole("button", { name: /B/ })).toHaveAttribute("aria-pressed", "true");
    expect(getByRole("button", { name: /A/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("says so when the tray is empty", () => {
    let trial = makeEmptyTrial();
    for (const lump of ["A", "B", "C", "D", "E"] as const) {
      trial = applyTest(trial, lump, "water", null);
    }
    const { getByText, queryAllByRole } = render(
      <LumpTray trial={trial} selectedLump={null} onSelect={() => undefined} />,
    );
    expect(getByText(/every lump has been used/i)).toBeInTheDocument();
    expect(queryAllByRole("button")).toHaveLength(0);
  });
});
