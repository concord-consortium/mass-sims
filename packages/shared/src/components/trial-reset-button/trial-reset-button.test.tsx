import { fireEvent, render } from "@testing-library/react";
import type { CSSProperties } from "react";
import { describe, expect, it, vi } from "vitest";
import { TrialResetButton } from "./trial-reset-button";

describe("TrialResetButton", () => {
  it("renders a real <button type=button> named 'Reset trial X' from the letter prop", () => {
    const { getByRole } = render(<TrialResetButton letter="B" onReset={() => {}} />);
    const button = getByRole("button", { name: "Reset trial B" });
    expect(button.tagName).toBe("BUTTON");
    // type=button so it never acts as a form-submit if a consumer nests it in a <form>.
    expect(button).toHaveAttribute("type", "button");
  });

  it("calls onReset when clicked while enabled", () => {
    const onReset = vi.fn();
    const { getByRole } = render(<TrialResetButton letter="A" onReset={onReset} />);
    fireEvent.click(getByRole("button", { name: "Reset trial A" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("omits aria-disabled when enabled (absent, not the string 'false')", () => {
    // Absent === not-disabled to assistive tech; emitting aria-disabled="false" would be noise.
    const { getByRole } = render(<TrialResetButton letter="A" onReset={() => {}} />);
    expect(getByRole("button", { name: "Reset trial A" })).not.toHaveAttribute("aria-disabled");
  });

  it("marks aria-disabled and guards activation when disabled", () => {
    // Disabled via aria-disabled (stays keyboard-focusable) + a JS guard, so the click is a no-op
    // rather than a native `disabled` attribute that drops it from the tab order.
    const onReset = vi.fn();
    const { getByRole } = render(<TrialResetButton letter="A" onReset={onReset} disabled />);
    const button = getByRole("button", { name: "Reset trial A" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled(); // NOT the native disabled attribute
    fireEvent.click(button);
    expect(onReset).not.toHaveBeenCalled();
  });

  it("merges an external className onto the shared .reset-button root", () => {
    const { getByRole } = render(
      <TrialResetButton letter="A" onReset={() => {}} className="panel-reset" />,
    );
    expect(getByRole("button", { name: "Reset trial A" })).toHaveClass(
      "reset-button",
      "panel-reset",
    );
  });

  it("forwards inline style to the button (e.g. the --selected-index positioning var)", () => {
    const { getByRole } = render(
      <TrialResetButton
        letter="A"
        onReset={() => {}}
        style={{ "--selected-index": 3 } as CSSProperties}
      />,
    );
    const button = getByRole("button", { name: "Reset trial A" });
    expect(button.style.getPropertyValue("--selected-index")).toBe("3");
  });

  it("renders the icon as decorative (aria-hidden)", () => {
    const { container } = render(<TrialResetButton letter="A" onReset={() => {}} />);
    expect(container.querySelector(".reset-button-icon")).toHaveAttribute("aria-hidden", "true");
  });
});
