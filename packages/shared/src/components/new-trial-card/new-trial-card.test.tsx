import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewTrialCard } from "./new-trial-card";

function renderCard(overrides: Partial<Parameters<typeof NewTrialCard>[0]> = {}) {
  const props = {
    onAdd: vi.fn(),
    tabIndex: 0,
    onKeyDown: vi.fn(),
    onFocus: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<NewTrialCard {...props} />) };
}

describe("NewTrialCard", () => {
  it("is a native button named 'Add new trial' (Enter/Space activate natively)", () => {
    const { getByRole } = renderCard();
    const button = getByRole("button", { name: "Add new trial" });
    expect(button).toHaveAttribute("type", "button");
  });

  it("carries the `.new-trial-card` class useTrialsKeyboardNav selects on", () => {
    // This is the contract that motivated sharing the component: the hook finds this card by class,
    // so the class lives here rather than in each sim, where it could be renamed out from under it.
    const { getByRole } = renderCard();
    expect(getByRole("button", { name: "Add new trial" })).toHaveClass("new-trial-card");
  });

  it("hides its icon from assistive tech and renders the visible 'New' text", () => {
    const { getByRole, container } = renderCard();
    expect(container.querySelector(".new-trial-card-icon")).toHaveAttribute("aria-hidden", "true");
    expect(getByRole("button", { name: "Add new trial" })).toHaveTextContent("New");
  });

  it("applies the roving tabIndex it is given", () => {
    const { getByRole, rerender } = renderCard({ tabIndex: -1 });
    expect(getByRole("button", { name: "Add new trial" })).toHaveAttribute("tabindex", "-1");
    rerender(<NewTrialCard tabIndex={0} onAdd={vi.fn()} onKeyDown={vi.fn()} onFocus={vi.fn()} />);
    expect(getByRole("button", { name: "Add new trial" })).toHaveAttribute("tabindex", "0");
  });

  it("calls onAdd on click, and forwards keydown/focus to the nav handlers", () => {
    // The card sits outside the listbox, so it can't inherit the listbox's delegated handler — it
    // must carry the hook's onKeyDown/onFocus itself for the arrow ring to reach it.
    const { props, getByRole } = renderCard();
    const button = getByRole("button", { name: "Add new trial" });

    fireEvent.click(button);
    expect(props.onAdd).toHaveBeenCalledOnce();

    fireEvent.keyDown(button, { key: "ArrowUp" });
    expect(props.onKeyDown).toHaveBeenCalledOnce();

    fireEvent.focus(button);
    expect(props.onFocus).toHaveBeenCalledOnce();
  });
});
