import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logEventSpy = vi.fn();
vi.mock("../../hooks/use-log-event", () => ({ useLogEvent: () => logEventSpy }));

import { Select } from "./select";

const OPTIONS = [
  { id: "slow", label: "Slow" },
  { id: "fast", label: "Fast" },
];

describe("Select", () => {
  beforeEach(() => logEventSpy.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("renders with a label and placeholder", () => {
    const { getByText } = render(<Select label="Speed" options={OPTIONS} placeholder="Choose…" />);
    expect(getByText("Speed")).toBeInTheDocument();
    expect(getByText("Choose…")).toBeInTheDocument();
  });

  it("applies the .select root class", () => {
    const { container } = render(<Select options={OPTIONS} />);
    expect(container.querySelector(".select")).toBeInTheDocument();
  });

  it("shows the current selection on the trigger", () => {
    const { container } = render(<Select options={OPTIONS} selectedKey="fast" />);
    const value = container.querySelector(".react-aria-SelectValue");
    expect(value).toHaveTextContent(/^Fast$/);
    expect(value).not.toHaveAttribute("data-placeholder");
  });

  it("opens the listbox and fires onSelectionChange with the chosen key", () => {
    const onSelectionChange = vi.fn();
    const { getByRole } = render(
      <Select options={OPTIONS} onSelectionChange={onSelectionChange} />,
    );
    fireEvent.click(getByRole("button"));
    fireEvent.click(getByRole("option", { name: "Fast" }));
    expect(onSelectionChange).toHaveBeenCalledWith("fast");
  });

  it("auto-emits a log event with value=<key> and actionParams when action is supplied", () => {
    const { getByRole } = render(
      <Select options={OPTIONS} action="speed_set" actionParams={{ trial: "A" }} />,
    );
    fireEvent.click(getByRole("button"));
    fireEvent.click(getByRole("option", { name: "Fast" }));
    expect(logEventSpy).toHaveBeenCalledWith(
      "speed_set",
      expect.objectContaining({ value: "fast", trial: "A" }),
    );
  });

  it("does NOT emit a log event when action is omitted", () => {
    const { getByRole } = render(<Select options={OPTIONS} />);
    fireEvent.click(getByRole("button"));
    fireEvent.click(getByRole("option", { name: "Fast" }));
    expect(logEventSpy).not.toHaveBeenCalled();
  });

  it("forwards isDisabled", () => {
    const { getByRole } = render(<Select options={OPTIONS} isDisabled />);
    expect(getByRole("button")).toBeDisabled();
  });

  // The non-modal popover (chosen so sibling controls stay hoverable while the list is open)
  // drops react-aria's built-in click-outside/toggle close, which CloseOnOutsidePointer restores.
  describe("CloseOnOutsidePointer", () => {
    it("closes the open listbox on a pointer-down outside it", () => {
      const { getByRole, queryByRole, getByTestId } = render(
        <div>
          <Select options={OPTIONS} />
          <div data-testid="outside">outside</div>
        </div>,
      );
      fireEvent.click(getByRole("button"));
      expect(getByRole("listbox")).toBeInTheDocument();

      fireEvent.pointerDown(getByTestId("outside"));
      expect(queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("closes on a pointer-down on the open trigger (toggle-to-close)", () => {
      const { getByRole, queryByRole } = render(<Select options={OPTIONS} />);
      const trigger = getByRole("button");
      fireEvent.click(trigger);
      expect(getByRole("listbox")).toBeInTheDocument();

      // A real click begins with pointerdown; the handler closes on that and swallows it so
      // react-aria can't reopen on the same gesture. That gesture-linked no-reopen depends on the
      // browser's pointer→click sequencing, which jsdom's discrete events can't reproduce; here we
      // assert the unit mechanism — the pointerdown on the expanded trigger dismisses the list.
      fireEvent.pointerDown(trigger);
      expect(queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("leaves a pointer-down inside the list to react-aria (does not pre-close a selection)", () => {
      const onSelectionChange = vi.fn();
      const { getByRole } = render(
        <Select options={OPTIONS} onSelectionChange={onSelectionChange} />,
      );
      fireEvent.click(getByRole("button"));
      const option = getByRole("option", { name: "Fast" });

      fireEvent.pointerDown(option);
      fireEvent.click(option);
      expect(onSelectionChange).toHaveBeenCalledWith("fast");
    });
  });
});
