import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrialCard } from "./trial-card";

describe("TrialCard", () => {
  it("derives the letter badge from index (A through J)", () => {
    const cases: Array<[number, string]> = [
      [0, "A"],
      [1, "B"],
      [2, "C"],
      [3, "D"],
      [4, "E"],
      [5, "F"],
      [6, "G"],
      [7, "H"],
      [8, "I"],
      [9, "J"],
    ];
    for (const [index, letter] of cases) {
      const { getByText, unmount } = render(
        <TrialCard index={index} selected={false} onSelect={() => {}}>
          content
        </TrialCard>,
      );
      expect(getByText(letter)).toBeInTheDocument();
      unmount();
    }
  });

  it("renders '?' as the badge and accessible name for an out-of-bounds index", () => {
    const { getByText, getByRole } = render(
      <TrialCard index={10} selected={false} onSelect={() => {}}>
        content
      </TrialCard>,
    );
    expect(getByText("?")).toBeInTheDocument();
    // The accessible name falls back too, so the option stays labeled rather than blank.
    expect(getByRole("option", { name: "Trial ?" })).toBeInTheDocument();
  });

  it("renders children as the card's body content", () => {
    const { getByText } = render(
      <TrialCard index={0} selected={false} onSelect={() => {}}>
        <span>Offspring: 12</span>
      </TrialCard>,
    );
    expect(getByText("Offspring: 12")).toBeInTheDocument();
  });

  it("renders the card as a real <button> exposed with role=option", () => {
    // A real <button> (NO role="button" workaround, NO nested buttons); its implicit button role is
    // overridden to `option` for listbox membership.
    const { getByRole } = render(
      <TrialCard index={2} selected={false} onSelect={() => {}}>
        body
      </TrialCard>,
    );
    const option = getByRole("option", { name: "Trial C" });
    expect(option.tagName).toBe("BUTTON");
  });

  it("wraps the option in a presentational (role=none) wrapper — reads as a direct listbox child", () => {
    const { container } = render(
      <TrialCard index={0} selected={false} onSelect={() => {}}>
        body
      </TrialCard>,
    );
    expect(container.querySelector(".trial-card-wrapper")).toHaveAttribute("role", "none");
  });

  it("reflects selection via aria-selected on the option", () => {
    const { getByRole, rerender } = render(
      <TrialCard index={0} selected={true} onSelect={() => {}}>
        body
      </TrialCard>,
    );
    expect(getByRole("option", { name: "Trial A" })).toHaveAttribute("aria-selected", "true");
    rerender(
      <TrialCard index={0} selected={false} onSelect={() => {}}>
        body
      </TrialCard>,
    );
    expect(getByRole("option", { name: "Trial A" })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onSelect when the option is clicked", () => {
    const onSelect = vi.fn();
    const { getByRole } = render(
      <TrialCard index={0} selected={false} onSelect={onSelect}>
        body
      </TrialCard>,
    );
    fireEvent.click(getByRole("option", { name: "Trial A" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("uses the ariaLabel prop as the accessible name, falling back to 'Trial X' when omitted", () => {
    const enriched = "Trial A. W1 crossed with C1. 12 offspring, 9 healthy, 3 infected.";
    const { getByRole, rerender } = render(
      <TrialCard index={0} selected={false} onSelect={() => {}} ariaLabel={enriched}>
        body
      </TrialCard>,
    );
    expect(getByRole("option", { name: enriched })).toBeInTheDocument();
    // Omitting it restores the default label.
    rerender(
      <TrialCard index={0} selected={false} onSelect={() => {}}>
        body
      </TrialCard>,
    );
    expect(getByRole("option", { name: "Trial A" })).toBeInTheDocument();
  });

  it("forwards the tabIndex prop to the option button (roving tabindex), defaulting to none", () => {
    const { getByRole, rerender } = render(
      <TrialCard index={0} selected={false} onSelect={() => {}} tabIndex={-1}>
        body
      </TrialCard>,
    );
    expect(getByRole("option", { name: "Trial A" })).toHaveAttribute("tabindex", "-1");
    // Omitting it leaves the button natively tabbable (no explicit tabindex attribute).
    rerender(
      <TrialCard index={0} selected={false} onSelect={() => {}}>
        body
      </TrialCard>,
    );
    expect(getByRole("option", { name: "Trial A" })).not.toHaveAttribute("tabindex");
  });

  it("applies the selected class to the wrapper", () => {
    const { container } = render(
      <TrialCard index={0} selected={true} onSelect={() => {}}>
        body
      </TrialCard>,
    );
    expect(container.querySelector(".trial-card-wrapper")).toHaveClass("selected");
  });
});
