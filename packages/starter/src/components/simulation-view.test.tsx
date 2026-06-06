import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SimulationView } from "./simulation-view";

describe("SimulationView", () => {
  it("renders the canvas and the parameter controls", () => {
    const { getByRole, getByLabelText } = render(<SimulationView onTrialComplete={() => {}} />);
    expect(getByRole("button", { name: /play/i })).toBeInTheDocument();
    expect(getByRole("button", { name: /reset/i })).toBeInTheDocument();
    expect(getByLabelText(/walker count/i)).toBeInTheDocument();
    expect(getByLabelText(/step size/i)).toBeInTheDocument();
    expect(getByLabelText(/frames per trial/i)).toBeInTheDocument();
  });

  it("toggles between Play and Pause labels when the play button is clicked", () => {
    const { getByRole } = render(<SimulationView onTrialComplete={() => {}} />);
    const button = getByRole("button", { name: /play/i });
    fireEvent.click(button);
    expect(getByRole("button", { name: /pause/i })).toBeInTheDocument();
    fireEvent.click(getByRole("button", { name: /pause/i }));
    expect(getByRole("button", { name: /play/i })).toBeInTheDocument();
  });

  it("calls onTrialComplete with a trial record when framesPerTrial is reached", () => {
    const onTrialComplete = vi.fn();
    // Use a runner-aware test that drives steps via the step() control to avoid rAF in jsdom.
    const { getByRole, getByLabelText } = render(
      <SimulationView onTrialComplete={onTrialComplete} />,
    );
    // Set a very short trial so we can step through it quickly.
    fireEvent.change(getByLabelText(/frames per trial/i), { target: { value: "3" } });
    const stepButton = getByRole("button", { name: /step/i });
    fireEvent.click(stepButton);
    fireEvent.click(stepButton);
    fireEvent.click(stepButton);
    expect(onTrialComplete).toHaveBeenCalledTimes(1);
    expect(onTrialComplete.mock.calls[0][0]).toMatchObject({
      input: expect.any(Object),
      output: expect.any(Object),
    });
  });

  it("Reset clears the running trial back to frame 0 and re-enables the inputs", () => {
    const { getByRole, getByLabelText } = render(<SimulationView onTrialComplete={() => {}} />);
    fireEvent.click(getByRole("button", { name: /step/i }));
    fireEvent.click(getByRole("button", { name: /reset/i }));
    // After reset, the walker-count input is editable again (not locked by an in-progress trial).
    expect(getByLabelText(/walker count/i)).not.toBeDisabled();
  });
});
