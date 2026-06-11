import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logEventSpy = vi.fn();
vi.mock("../../hooks/use-log-event", () => ({
  useLogEvent: () => logEventSpy,
}));

import { Slider } from "./slider";

describe("Slider", () => {
  beforeEach(() => logEventSpy.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("renders with a label and the current value", () => {
    const { getByText, getByRole } = render(
      <Slider label="Walkers" value={42} minValue={0} maxValue={100} />,
    );
    expect(getByText("Walkers")).toBeInTheDocument();
    expect(getByRole("slider")).toHaveAttribute("aria-valuetext", "42");
  });

  it("applies the .slider root class", () => {
    const { container } = render(<Slider value={1} minValue={0} maxValue={10} />);
    expect(container.querySelector(".slider")).toBeInTheDocument();
  });

  it("supports uncontrolled mode via defaultValue (no value prop)", () => {
    const { getByRole } = render(
      <Slider label="Walkers" defaultValue={30} minValue={0} maxValue={100} />,
    );
    expect(getByRole("slider")).toHaveAttribute("aria-valuetext", "30");
  });

  it("calls onChange during drag (keyboard nudge)", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <Slider value={5} minValue={0} maxValue={10} step={1} onChange={onChange} />,
    );
    fireEvent.keyDown(getByRole("slider"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalled();
  });

  it("emits the log event exactly once per keyboard commit (not twice from onChange + onChangeEnd)", () => {
    const { getByRole } = render(
      <Slider value={5} minValue={0} maxValue={10} step={1} action="walkers_set" />,
    );
    fireEvent.keyDown(getByRole("slider"), { key: "ArrowRight" });
    expect(logEventSpy).toHaveBeenCalledTimes(1);
  });

  it("emits a log event on commit (onChangeEnd) including the value and any actionParams", () => {
    const { getByRole } = render(
      <Slider
        value={5}
        minValue={0}
        maxValue={10}
        step={1}
        action="walkers_set"
        actionParams={{ trial: "A" }}
      />,
    );
    fireEvent.keyDown(getByRole("slider"), { key: "ArrowRight" });
    expect(logEventSpy).toHaveBeenCalledWith(
      "walkers_set",
      expect.objectContaining({ value: 6, trial: "A" }),
    );
  });

  it("does NOT emit a log event when action is omitted", () => {
    const { getByRole } = render(<Slider value={5} minValue={0} maxValue={10} step={1} />);
    fireEvent.keyDown(getByRole("slider"), { key: "ArrowRight" });
    expect(logEventSpy).not.toHaveBeenCalled();
  });

  it("forwards isDisabled to the underlying control and suppresses onChange", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <Slider value={5} minValue={0} maxValue={10} step={1} isDisabled onChange={onChange} />,
    );
    fireEvent.keyDown(getByRole("slider"), { key: "ArrowRight" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("formats the displayed value via formatOptions", () => {
    const { container } = render(
      <Slider
        value={0.5}
        minValue={0}
        maxValue={1}
        step={0.1}
        formatOptions={{ style: "percent", maximumFractionDigits: 0 }}
      />,
    );
    // react-aria's SliderOutput formats via Intl.NumberFormat — at 0.5 with percent format, output is "50%".
    expect(container.querySelector(".slider")?.textContent).toMatch(/50%/);
  });
});
