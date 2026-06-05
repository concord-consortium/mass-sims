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
        <TrialCard index={index} selected={false} onSelect={() => {}} onReset={() => {}}>
          content
        </TrialCard>,
      );
      expect(getByText(letter)).toBeInTheDocument();
      unmount();
    }
  });

  it("renders children as the card's body content", () => {
    const { getByText } = render(
      <TrialCard index={0} selected={false} onSelect={() => {}} onReset={() => {}}>
        <span>Offspring: 12</span>
      </TrialCard>,
    );
    expect(getByText("Offspring: 12")).toBeInTheDocument();
  });

  it("calls onSelect when the card body is clicked", () => {
    const onSelect = vi.fn();
    const { getByRole } = render(
      <TrialCard index={0} selected={false} onSelect={onSelect} onReset={() => {}}>
        body
      </TrialCard>,
    );
    fireEvent.click(getByRole("button", { name: /trial a/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("does NOT show the reset button when not selected", () => {
    const { queryByRole } = render(
      <TrialCard index={0} selected={false} onSelect={() => {}} onReset={() => {}}>
        body
      </TrialCard>,
    );
    expect(queryByRole("button", { name: /reset/i })).not.toBeInTheDocument();
  });

  it("shows the reset button when selected", () => {
    const { getByRole } = render(
      <TrialCard index={0} selected={true} onSelect={() => {}} onReset={() => {}}>
        body
      </TrialCard>,
    );
    expect(getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  it("calls onReset when the reset button is clicked and does NOT call onSelect", () => {
    const onReset = vi.fn();
    const onSelect = vi.fn();
    const { getByRole } = render(
      <TrialCard index={0} selected={true} onSelect={onSelect} onReset={onReset}>
        body
      </TrialCard>,
    );
    fireEvent.click(getByRole("button", { name: /reset/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
    // The reset button is a sibling of the card button (NOT nested), so the reset
    // click can't bubble to onSelect — no stopPropagation needed in the implementation.
    // This assertion locks in that structural choice.
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("marks the reset button aria-disabled when resetDisabled is true and does not call onReset", () => {
    const onReset = vi.fn();
    const { getByRole } = render(
      <TrialCard
        index={0}
        selected={true}
        onSelect={() => {}}
        onReset={onReset}
        resetDisabled={true}
      >
        body
      </TrialCard>,
    );
    const resetBtn = getByRole("button", { name: /reset/i });
    expect(resetBtn).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(resetBtn);
    expect(onReset).not.toHaveBeenCalled();
  });

  it("exposes both the card and reset as real <button> elements with distinct accessible names", () => {
    // Locks in the architectural choice: NO nested-button anti-pattern, NO role="button"
    // workaround. Two real <button> siblings inside a positioning wrapper.
    const { getByRole, container } = render(
      <TrialCard index={2} selected={true} onSelect={() => {}} onReset={() => {}}>
        body
      </TrialCard>,
    );
    const card = getByRole("button", { name: "Trial C" });
    const reset = getByRole("button", { name: "Reset trial C" });
    expect(card.tagName).toBe("BUTTON");
    expect(reset.tagName).toBe("BUTTON");
    // The reset must not be a DOM descendant of the card button (nested buttons are
    // invalid HTML and produce inconsistent screen-reader behavior).
    expect(card.contains(reset)).toBe(false);
    // Both buttons live inside the same wrapper.
    const wrapper = container.querySelector(".trial-card-wrapper");
    expect(wrapper?.contains(card)).toBe(true);
    expect(wrapper?.contains(reset)).toBe(true);
  });

  it("applies the selected class to the wrapper", () => {
    const { container } = render(
      <TrialCard index={0} selected={true} onSelect={() => {}} onReset={() => {}}>
        body
      </TrialCard>,
    );
    expect(container.querySelector(".trial-card-wrapper")).toHaveClass("selected");
  });
});
