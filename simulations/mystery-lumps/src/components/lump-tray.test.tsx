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
    fireEvent.click(getByRole("button", { name: /3/ }));
    expect(onSelect).toHaveBeenCalledWith("3");
  });

  it("keeps the slot once its lump is used up, but empties it", () => {
    const trial = applyTest(makeEmptyTrial(), "3", "water", null);
    const { container, getAllByRole, getByRole } = render(
      <LumpTray trial={trial} selectedLump="3" onSelect={() => undefined} />,
    );
    // All five slots stay, so the tray never reflows under the student's hand.
    expect(getAllByRole("button")).toHaveLength(5);
    const spent = getByRole("button", { name: /sample 3, used up/i });
    expect(spent).toBeDisabled();
    // The slot is there; the lump in it is not.
    expect(spent.querySelector(".tray-empty-slot")).toBeInTheDocument();
    expect(spent.querySelector(".tray-lump")).toBeNull();
    expect(container.querySelectorAll(".tray-lump")).toHaveLength(4);
  });

  it("will not put a used-up lump back on the bench", () => {
    const onSelect = vi.fn();
    const trial = applyTest(makeEmptyTrial(), "3", "water", null);
    const { getByRole } = render(
      <LumpTray trial={trial} selectedLump={null} onSelect={onSelect} />,
    );
    fireEvent.click(getByRole("button", { name: /sample 3, used up/i }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("marks the lump that is on the bench", () => {
    const { getByRole } = render(
      <LumpTray trial={makeEmptyTrial()} selectedLump="2" onSelect={() => undefined} />,
    );
    expect(getByRole("button", { name: /2/ })).toHaveAttribute("aria-pressed", "true");
    expect(getByRole("button", { name: /1/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("says so when the tray is empty", () => {
    let trial = makeEmptyTrial();
    for (const lump of ["1", "2", "3", "4", "5"] as const) {
      trial = applyTest(trial, lump, "water", null);
    }
    const { container, getByText, getAllByRole } = render(
      <LumpTray trial={trial} selectedLump={null} onSelect={() => undefined} />,
    );
    expect(getByText(/every sample has been used/i)).toBeInTheDocument();
    // Five empty slots, none of them selectable.
    expect(getAllByRole("button")).toHaveLength(5);
    expect(container.querySelectorAll(".tray-lump")).toHaveLength(0);
    for (const slot of getAllByRole("button")) expect(slot).toBeDisabled();
  });
});
