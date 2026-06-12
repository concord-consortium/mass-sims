import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logEventSpy = vi.fn();
vi.mock("../../hooks/use-log-event", () => ({ useLogEvent: () => logEventSpy }));

import { NumberField } from "./number-field";

describe("NumberField", () => {
  beforeEach(() => logEventSpy.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("renders with a label and value", () => {
    const { getByText, getByRole } = render(<NumberField label="Frames per trial" value={200} />);
    expect(getByText("Frames per trial")).toBeInTheDocument();
    // In rac ^1.18 the NumberField input is a type="text" element (role "textbox")
    // with aria-roledescription="Number field", not a native spinbutton.
    expect(getByRole("textbox")).toHaveValue("200");
  });

  it("supports uncontrolled mode via defaultValue (no value prop)", () => {
    const { getByRole } = render(<NumberField label="Frames" defaultValue={150} />);
    expect(getByRole("textbox")).toHaveValue("150");
  });

  it("renders increment and decrement buttons", () => {
    const { getAllByRole } = render(<NumberField label="Frames" value={100} />);
    const buttons = getAllByRole("button");
    expect(buttons).toHaveLength(2);
  });

  it("fires onChange when the value is committed", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <NumberField
        label="Frames"
        value={100}
        step={50}
        minValue={0}
        maxValue={500}
        onChange={onChange}
      />,
    );
    const incrementButton = getByRole("button", { name: /increase|increment/i });
    fireEvent.click(incrementButton);
    expect(onChange).toHaveBeenCalledWith(150);
  });

  it("auto-emits a log event with the committed value when action is supplied", () => {
    const { getByRole } = render(
      <NumberField
        label="Frames"
        value={100}
        step={50}
        action="frames_set"
        actionParams={{ trial: "A" }}
      />,
    );
    fireEvent.click(getByRole("button", { name: /increase|increment/i }));
    expect(logEventSpy).toHaveBeenCalledWith(
      "frames_set",
      expect.objectContaining({ value: 150, trial: "A" }),
    );
  });

  it("does NOT emit a log event when action is omitted", () => {
    const { getByRole } = render(<NumberField label="Frames" value={100} />);
    fireEvent.click(getByRole("button", { name: /increase|increment/i }));
    expect(logEventSpy).not.toHaveBeenCalled();
  });

  it("respects minValue / maxValue", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <NumberField label="Frames" value={500} minValue={1} maxValue={500} onChange={onChange} />,
    );
    fireEvent.click(getByRole("button", { name: /increase|increment/i }));
    expect(onChange).not.toHaveBeenCalledWith(expect.any(Number));
  });

  it("forwards isDisabled", () => {
    const { getByRole } = render(<NumberField label="Frames" value={100} isDisabled />);
    expect(getByRole("textbox")).toBeDisabled();
  });
});
