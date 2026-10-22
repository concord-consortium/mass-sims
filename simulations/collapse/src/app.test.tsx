import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `vi.hoisted` so the mocks exist when `vi.mock` runs.
const { useInitMessageMock, setInteractiveStateMock } = vi.hoisted(() => ({
  useInitMessageMock: vi.fn(),
  setInteractiveStateMock: vi.fn(),
}));
vi.mock("@concord-consortium/lara-interactive-api", () => ({
  useInitMessage: useInitMessageMock,
  setInteractiveState: setInteractiveStateMock,
}));

import { App } from "./app";

// Nothing in the UI can run a trial yet, so tests that need a recorded output restore one (trial A,
// plus any `extraTrials`) through AP saved state. This makes the sim embedded, because a restore
// only arrives in an AP init message.
function restoreTrialAWithOutput({
  selected = "A",
  extraTrials = {},
}: {
  selected?: string;
  extraTrials?: object;
} = {}) {
  const trialA = {
    input: { walkerCount: 50, stepSize: 1, framesPerTrial: 200, seed: "saved-A" },
    output: { avgDistance: 3.14, stdDevDistance: 0.5, avgDistanceSeries: [1, 2, 3] },
    finalTransient: null,
  };
  useInitMessageMock.mockReturnValue({
    mode: "runtime",
    interactiveState: {
      version: 1,
      trials: { A: trialA, ...extraTrials },
      selectedTrialLetter: selected,
    },
  });
}

/** The trial options' "Trial X" names, in rendered order. */
function trialOptions(view: ReturnType<typeof render>) {
  return view.getAllByRole("option").map((o) => o.getAttribute("aria-label")?.slice(0, 7));
}

/** Whether the selected trial has a recorded output, read from whether its reset is enabled. */
function selectedHasOutput(view: ReturnType<typeof render>, letter: string) {
  const reset = view.getByRole("button", { name: `Reset trial ${letter}` });
  return reset.getAttribute("aria-disabled") !== "true";
}

// Standalone by default: the real `useInitMessage` returns null (not undefined) outside AP.
beforeEach(() => {
  useInitMessageMock.mockReturnValue(null);
});

describe("Collapse App", () => {
  it("renders the SimulationFrame with the Collapse! title, tagline, and instruction", () => {
    const { getByRole, getByText } = render(<App />);
    expect(getByRole("heading", { level: 1, name: "Collapse!" })).toBeInTheDocument();
    expect(getByText("Which conditions form caves?")).toBeInTheDocument();
    expect(getByText("Select a trial, then sample through time")).toBeInTheDocument();
  });

  it("renders the Trials and Simulation regions and no Data region", () => {
    const { getByRole, queryByRole } = render(<App />);
    expect(getByRole("region", { name: "Trials" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Simulation" })).toBeInTheDocument();
    expect(queryByRole("region", { name: "Data" })).not.toBeInTheDocument();
  });

  it("loads with four empty trials A–D, A selected, and no New card", () => {
    const view = render(<App />);
    expect(trialOptions(view)).toEqual(["Trial A", "Trial B", "Trial C", "Trial D"]);
    expect(view.getByRole("option", { name: /^Trial A/ })).toHaveAttribute("aria-selected", "true");
    expect(view.queryByRole("button", { name: "Add new trial" })).toBeNull();
    expect(selectedHasOutput(view, "A")).toBe(false);
  });

  it("resets a completed trial back to empty without deleting the card", () => {
    restoreTrialAWithOutput();
    const view = render(<App />);
    expect(selectedHasOutput(view, "A")).toBe(true);
    fireEvent.click(view.getByRole("button", { name: "Reset trial A" }));
    expect(view.getByRole("option", { name: /^Trial A/ })).toBeInTheDocument();
    expect(selectedHasOutput(view, "A")).toBe(false);
  });

  it("does NOT register a beforeunload listener before any trial is run", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    render(<App />);
    expect(addSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
    addSpy.mockRestore();
  });
});

describe("Collapse App — AP saved state", () => {
  beforeEach(() => {
    useInitMessageMock.mockReturnValue(null);
    setInteractiveStateMock.mockReset();
  });

  it("restores trials + selectedTrialLetter from a runtime init message's interactiveState", () => {
    const trialB = {
      input: { walkerCount: 100, stepSize: 2, framesPerTrial: 200, seed: "saved-B" },
      output: null,
      finalTransient: null,
    };
    restoreTrialAWithOutput({ selected: "B", extraTrials: { B: trialB } });
    const view = render(<App />);
    expect(trialOptions(view)).toEqual(["Trial A", "Trial B", "Trial C", "Trial D"]);
    expect(view.getByRole("option", { name: /^Trial B/ })).toHaveAttribute("aria-selected", "true");
    expect(view.getByRole("option", { name: /^Trial A/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(selectedHasOutput(view, "B")).toBe(false);
    // Trial A's saved output was restored too.
    fireEvent.click(view.getByRole("option", { name: /^Trial A/ }));
    expect(selectedHasOutput(view, "A")).toBe(true);
  });

  it("keeps persisted trials and selects A when the saved letter is outside A–D", () => {
    // A bad selected letter must not discard the student's trials.
    restoreTrialAWithOutput({ selected: "E" });
    const view = render(<App />);
    expect(view.getByRole("option", { name: /^Trial A/ })).toHaveAttribute("aria-selected", "true");
    expect(selectedHasOutput(view, "A")).toBe(true);
  });

  it("does NOT restore when the init message has interactiveState: null (first session)", () => {
    useInitMessageMock.mockReturnValue({ mode: "runtime", interactiveState: null });
    const view = render(<App />);
    expect(trialOptions(view)).toEqual(["Trial A", "Trial B", "Trial C", "Trial D"]);
    expect(selectedHasOutput(view, "A")).toBe(false);
  });

  it("calls setInteractiveState on every trial-list change (restore / reset)", () => {
    restoreTrialAWithOutput();
    const view = render(<App />);
    // Mount and restore push the restored state.
    expect(setInteractiveStateMock).toHaveBeenCalled();
    const restored = setInteractiveStateMock.mock.calls.at(-1)?.[0] as {
      trials: Record<string, { output: unknown }>;
    };
    expect(Object.keys(restored.trials)).toEqual(["A", "B", "C", "D"]);
    expect(restored.trials.A.output).not.toBeNull();

    setInteractiveStateMock.mockClear();
    fireEvent.click(view.getByRole("button", { name: "Reset trial A" }));
    expect(setInteractiveStateMock).toHaveBeenCalled();
    const reset = setInteractiveStateMock.mock.calls.at(-1)?.[0] as {
      trials: Record<string, { output: unknown }>;
    };
    expect(reset.trials.A.output).toBeNull();
  });

  it("does NOT register a beforeunload listener when embedded (AP persists progress)", () => {
    // Embedded with progress: AP saves it, so there is no reload warning.
    restoreTrialAWithOutput();
    const addSpy = vi.spyOn(window, "addEventListener");
    const view = render(<App />);
    expect(selectedHasOutput(view, "A")).toBe(true);
    expect(addSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
    addSpy.mockRestore();
  });
});
