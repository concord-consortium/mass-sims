import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RecordedTrial } from "../model/types";

// The shared <Button> auto-emits via useLogEvent → lara-interactive-api's log(action, data).
// Mock that transport (not useLogEvent, which Button imports internally) and assert the press
// emits. vi.hoisted so the mock fn exists when vi.mock runs.
const { log } = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("@concord-consortium/lara-interactive-api", () => ({ log }));

import { SimulationView } from "./simulation-view";

const emptyTrial = (overrides: Partial<RecordedTrial["input"]> = {}): RecordedTrial => ({
  id: "t1",
  input: { walkerCount: 50, stepSize: 1, framesPerTrial: 200, seed: "test-seed", ...overrides },
  output: null,
  finalTransient: null,
});

const noopProps = {
  trialLabel: "A",
  onInputChange: () => {},
  onComplete: () => {},
  onReset: () => {},
};

describe("SimulationView", () => {
  it("renders the canvas and the parameter controls", () => {
    const { getByRole, getByLabelText } = render(
      <SimulationView trial={emptyTrial()} {...noopProps} />,
    );
    expect(getByRole("button", { name: /play/i })).toBeInTheDocument();
    expect(getByRole("button", { name: /reset/i })).toBeInTheDocument();
    expect(getByLabelText(/walker count/i)).toBeInTheDocument();
    expect(getByLabelText(/step size/i)).toBeInTheDocument();
    expect(getByLabelText(/frames per trial/i)).toBeInTheDocument();
  });

  it("shows the trial letter badge in the region", () => {
    const { container } = render(
      <SimulationView trial={emptyTrial()} {...noopProps} trialLabel="C" />,
    );
    expect(container.querySelector(".trial-badge")?.textContent).toBe("C");
  });

  it("toggles between Play and Pause labels when the play button is clicked", () => {
    const { getByRole } = render(<SimulationView trial={emptyTrial()} {...noopProps} />);
    fireEvent.click(getByRole("button", { name: /play/i }));
    expect(getByRole("button", { name: /pause/i })).toBeInTheDocument();
    fireEvent.click(getByRole("button", { name: /pause/i }));
    expect(getByRole("button", { name: /play/i })).toBeInTheDocument();
  });

  it("calls onComplete with the output and final snapshot when framesPerTrial is reached", () => {
    const onComplete = vi.fn();
    const { getByRole, getByLabelText } = render(
      <SimulationView trial={emptyTrial()} {...noopProps} onComplete={onComplete} />,
    );
    // Shorten the trial so we can step through it quickly (avoids rAF in jsdom).
    fireEvent.change(getByLabelText(/frames per trial/i), { target: { value: "2" } });
    const stepButton = getByRole("button", { name: /step/i });
    fireEvent.click(stepButton);
    fireEvent.click(stepButton);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toMatchObject({ avgDistance: expect.any(Number) });
    expect(onComplete.mock.calls[0][1]).toMatchObject({ frame: 2, walkers: expect.any(Array) });
  });

  it("delegates Reset to onReset once a run has started", () => {
    const onReset = vi.fn();
    const { getByRole } = render(
      <SimulationView trial={emptyTrial()} {...noopProps} onReset={onReset} />,
    );
    // Reset is disabled at frame 0 (nothing to reset); a single Step enables it.
    fireEvent.click(getByRole("button", { name: /step/i }));
    fireEvent.click(getByRole("button", { name: /reset/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("fires onProgress whenever a new avg-distance sample lands (every 10 frames)", () => {
    const onProgress = vi.fn();
    const { getByRole, getByLabelText } = render(
      <SimulationView trial={emptyTrial()} {...noopProps} onProgress={onProgress} />,
    );
    // Set a 20-frame trial — short enough that we can step through it but long enough that two
    // samples (frame 10 and frame 20) land. SAMPLE_EVERY = 10 in the model.
    fireEvent.change(getByLabelText(/frames per trial/i), { target: { value: "20" } });
    const stepButton = getByRole("button", { name: /step/i });
    // Step 9 frames: no sample yet (sample lands AT frame 10, not before).
    for (let i = 0; i < 9; i++) fireEvent.click(stepButton);
    expect(onProgress).not.toHaveBeenCalled();
    // 10th step lands the first sample.
    fireEvent.click(stepButton);
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress.mock.calls[0][0]).toHaveLength(1);
    // Step another 10 frames to land the second sample.
    for (let i = 0; i < 10; i++) fireEvent.click(stepButton);
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress.mock.calls[1][0]).toHaveLength(2);
  });

  it("emits play_pressed when Play is clicked", () => {
    log.mockReset();
    const { getByRole } = render(<SimulationView trial={emptyTrial()} {...noopProps} />);
    fireEvent.click(getByRole("button", { name: /play/i }));
    expect(log).toHaveBeenCalledWith(
      "play_pressed",
      expect.objectContaining({ trial: expect.any(String) }),
    );
  });

  it("disables Play for an already-completed trial (must Reset first)", () => {
    const completed: RecordedTrial = {
      id: "t1",
      input: { walkerCount: 3, stepSize: 1, framesPerTrial: 2, seed: "s" },
      output: { avgDistance: 1, stdDevDistance: 0.5, avgDistanceSeries: [1] },
      finalTransient: {
        frame: 2,
        walkers: [{ x: 1, y: 1 }],
        avgDistanceSeries: [1],
      },
    };
    const { getByRole } = render(<SimulationView trial={completed} {...noopProps} />);
    expect(getByRole("button", { name: /play/i })).toBeDisabled();
  });
});
