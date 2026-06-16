import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The shared <Button> and the FungusSwitch auto-emit via useLogEvent → lara-interactive-api's
// log(action, data). Mock that transport. vi.hoisted so the mock exists when vi.mock runs.
const { log } = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("@concord-consortium/lara-interactive-api", () => ({ log }));

import { ControlBar, type ControlBarProps } from "./control-bar";

const baseProps: ControlBarProps = {
  canCross: false,
  fungusOn: false,
  isFungusLocked: false,
  canReset: false,
  onCrossPlants: () => {},
  onSetFungus: () => {},
  onResetTrial: () => {},
};

describe("ControlBar", () => {
  it("renders the Fungus switch plus Cross Plants and Reset Trial buttons", () => {
    const { getByRole } = render(<ControlBar {...baseProps} />);
    expect(getByRole("switch", { name: "Fungus" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Cross Plants" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Reset Trial" })).toBeInTheDocument();
  });

  it("renders the controls left-to-right as Fungus, Cross Plants, Reset Trial", () => {
    const { getByRole } = render(<ControlBar {...baseProps} />);
    const fungus = getByRole("switch", { name: "Fungus" });
    const cross = getByRole("button", { name: "Cross Plants" });
    const reset = getByRole("button", { name: "Reset Trial" });
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
    expect(fungus.compareDocumentPosition(cross) & FOLLOWING).toBeTruthy();
    expect(cross.compareDocumentPosition(reset) & FOLLOWING).toBeTruthy();
  });

  it("disables Cross Plants when canCross is false, enables it when true, presses, and logs", () => {
    const onCrossPlants = vi.fn();
    const { getByRole, rerender } = render(
      <ControlBar {...baseProps} canCross={false} onCrossPlants={onCrossPlants} />,
    );
    expect(getByRole("button", { name: "Cross Plants" })).toBeDisabled();

    rerender(<ControlBar {...baseProps} canCross={true} onCrossPlants={onCrossPlants} />);
    const button = getByRole("button", { name: "Cross Plants" });
    expect(button).not.toBeDisabled();
    log.mockReset();
    fireEvent.click(button);
    expect(onCrossPlants).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("cross_plants_pressed", undefined);
  });

  it("disables Reset Trial when canReset is false, enables it when true, presses, and logs", () => {
    const onResetTrial = vi.fn();
    const { getByRole, rerender } = render(
      <ControlBar {...baseProps} canReset={false} onResetTrial={onResetTrial} />,
    );
    expect(getByRole("button", { name: "Reset Trial" })).toBeDisabled();

    rerender(<ControlBar {...baseProps} canReset={true} onResetTrial={onResetTrial} />);
    const button = getByRole("button", { name: "Reset Trial" });
    expect(button).not.toBeDisabled();
    log.mockReset();
    fireEvent.click(button);
    expect(onResetTrial).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("reset_trial_pressed", undefined);
  });

  it("reflects fungusOn on the switch and calls onSetFungus + logs fungus_set on toggle", () => {
    const onSetFungus = vi.fn();
    const { getByRole, rerender } = render(
      <ControlBar {...baseProps} fungusOn={false} onSetFungus={onSetFungus} />,
    );
    const switchEl = getByRole("switch", { name: "Fungus" });
    expect(switchEl).not.toBeChecked();

    log.mockReset();
    fireEvent.click(switchEl);
    expect(onSetFungus).toHaveBeenCalledWith(true);
    expect(log).toHaveBeenCalledWith("fungus_set", expect.objectContaining({ value: true }));

    rerender(<ControlBar {...baseProps} fungusOn={true} onSetFungus={onSetFungus} />);
    expect(getByRole("switch", { name: "Fungus" })).toBeChecked();
    fireEvent.click(getByRole("switch", { name: "Fungus" }));
    expect(onSetFungus).toHaveBeenCalledWith(false);
  });

  it("renders the Fungus switch disabled when isFungusLocked is true", () => {
    const { getByRole } = render(<ControlBar {...baseProps} isFungusLocked />);
    expect(getByRole("switch", { name: "Fungus" })).toBeDisabled();
  });
});
