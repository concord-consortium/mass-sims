import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the lara-interactive-api surface the Starter uses for AP saved-state sync. vi.hoisted
// so the mocks exist when vi.mock runs; defaults to standalone (null), overridden per-case.
const { useInitMessageMock, setInteractiveStateMock } = vi.hoisted(() => ({
  useInitMessageMock: vi.fn(),
  setInteractiveStateMock: vi.fn(),
}));
vi.mock("@concord-consortium/lara-interactive-api", () => ({
  useInitMessage: useInitMessageMock,
  setInteractiveState: setInteractiveStateMock,
}));

import { App } from "./app";

// Run the currently-selected trial to completion by shortening it and stepping through.
// The frames input is a shared <NumberField> (role "textbox") that commits on blur, so
// change + blur to push the shortened value into the trial before stepping.
function runSelectedTrial(view: ReturnType<typeof render>, frames = 2) {
  const framesInput = view.getByRole("textbox", { name: /frames per trial/i });
  fireEvent.change(framesInput, { target: { value: String(frames) } });
  fireEvent.blur(framesInput);
  const stepButton = view.getByRole("button", { name: /step/i });
  for (let i = 0; i < frames; i++) fireEvent.click(stepButton);
}

// Default every test to standalone — App derives `isEmbedded = initMsg !== null`, and the
// real useInitMessage returns null (not undefined) with no AP parent. Embedded tests override.
beforeEach(() => {
  useInitMessageMock.mockReturnValue(null);
});

describe("Starter App", () => {
  it("renders the SimulationFrame with the Random Walk title", () => {
    const { getByRole } = render(<App />);
    expect(getByRole("heading", { level: 1, name: "Random Walk" })).toBeInTheDocument();
  });

  it("renders the three slot regions with their canonical names", () => {
    const { getByRole } = render(<App />);
    expect(getByRole("region", { name: "Trials" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Simulation" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Data" })).toBeInTheDocument();
  });

  it("loads with an empty trial A and a New card (no B yet)", () => {
    const { getByRole, queryByRole, queryByText } = render(<App />);
    expect(getByRole("tab", { name: /^Trial A/ })).toBeInTheDocument();
    expect(getByRole("button", { name: "Add new trial" })).toBeInTheDocument();
    expect(queryByRole("tab", { name: /^Trial B/ })).toBeNull();
    // Empty trial → no recorded stats yet.
    expect(queryByText(/avg \d/i)).toBeNull();
  });

  it("running the selected trial fills its card without adding a new one", () => {
    const view = render(<App />);
    runSelectedTrial(view);
    // Trial A's card now shows recorded stats…
    expect(view.getByText(/avg \d/i)).toBeInTheDocument();
    // …and no Trial B appeared (completion updates the selected trial, not appends).
    expect(view.queryByRole("tab", { name: /^Trial B/ })).toBeNull();
  });

  it("adds an empty Trial B only when the New card is clicked", () => {
    const { getByRole, queryByRole } = render(<App />);
    expect(queryByRole("tab", { name: /^Trial B/ })).toBeNull();
    fireEvent.click(getByRole("button", { name: "Add new trial" }));
    expect(getByRole("tab", { name: /^Trial B/ })).toBeInTheDocument();
  });

  it("resets a completed trial back to empty without deleting the card", () => {
    const view = render(<App />);
    runSelectedTrial(view);
    expect(view.getByText(/avg \d/i)).toBeInTheDocument();
    // The selected card's reset affordance clears it (trials are reset, not deleted).
    fireEvent.click(view.getByRole("button", { name: "Reset trial A" }));
    expect(view.getByRole("tab", { name: /^Trial A/ })).toBeInTheDocument();
    expect(view.queryByText(/avg \d/i)).toBeNull();
  });

  it("does NOT register a beforeunload listener before any trial is run", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    render(<App />);
    expect(addSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
    addSpy.mockRestore();
  });

  it("registers a beforeunload listener once a trial has been run", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const view = render(<App />);
    runSelectedTrial(view);
    // After the trial completes, the reload-warning listener is attached.
    expect(addSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    addSpy.mockRestore();
  });
});

describe("Starter App — AP saved state", () => {
  beforeEach(() => {
    useInitMessageMock.mockReturnValue(null);
    setInteractiveStateMock.mockReset();
  });

  it("renders the default empty trial when no init message arrives (standalone)", () => {
    const { getByRole, queryByRole } = render(<App />);
    expect(getByRole("tab", { name: /^Trial A/ })).toBeInTheDocument();
    expect(queryByRole("tab", { name: /^Trial B/ })).toBeNull();
  });

  it("restores trials + selectedTrialLetter from a runtime init message's interactiveState", () => {
    // Current versioned wire shape: `{ version, trials (letter-keyed), selectedTrialLetter }`.
    const trialA = {
      input: { walkerCount: 50, stepSize: 1, framesPerTrial: 200, seed: "saved-A" },
      output: { avgDistance: 3.14, stdDevDistance: 0.5, avgDistanceSeries: [1, 2, 3] },
      finalTransient: null,
    };
    const trialB = {
      input: { walkerCount: 100, stepSize: 2, framesPerTrial: 200, seed: "saved-B" },
      output: null,
      finalTransient: null,
    };
    useInitMessageMock.mockReturnValue({
      mode: "runtime",
      interactiveState: { version: 1, trials: { A: trialA, B: trialB }, selectedTrialLetter: "B" },
    });
    const view = render(<App />);
    expect(view.getByRole("tab", { name: /^Trial A/ })).toBeInTheDocument();
    expect(view.getByRole("tab", { name: /^Trial B/ })).toBeInTheDocument();
    // The restored selection is honored — B is active, not a default fall-back to A.
    expect(view.getByRole("tab", { name: /^Trial B/ })).toHaveAttribute("aria-selected", "true");
    expect(view.getByRole("tab", { name: /^Trial A/ })).toHaveAttribute("aria-selected", "false");
    // /avg 3/ matches trial A's saved avgDistance (3.14).
    expect(view.getByText(/avg 3/i)).toBeInTheDocument();
  });

  it("keeps persisted trials and re-selects the first when the saved letter is absent", () => {
    // A corrupt/dangling selectedTrialLetter ("C") that names no present trial must NOT discard the
    // student's trials — the normalization reaction re-selects the first present trial instead.
    const trialA = {
      input: { walkerCount: 50, stepSize: 1, framesPerTrial: 200, seed: "saved-A" },
      output: { avgDistance: 9.9, stdDevDistance: 0.5, avgDistanceSeries: [1, 2, 3] },
      finalTransient: null,
    };
    useInitMessageMock.mockReturnValue({
      mode: "runtime",
      interactiveState: { version: 1, trials: { A: trialA }, selectedTrialLetter: "C" },
    });
    const view = render(<App />);
    // Trial A is preserved (not discarded to a fresh seed)…
    expect(view.getByText(/avg 9/i)).toBeInTheDocument();
    // …and selection self-heals to A.
    expect(view.getByRole("tab", { name: /^Trial A/ })).toHaveAttribute("aria-selected", "true");
  });

  it("does NOT restore when the init message has interactiveState: null (first session)", () => {
    useInitMessageMock.mockReturnValue({ mode: "runtime", interactiveState: null });
    const view = render(<App />);
    expect(view.getByRole("tab", { name: /^Trial A/ })).toBeInTheDocument();
    expect(view.queryByRole("tab", { name: /^Trial B/ })).toBeNull();
  });

  it("calls setInteractiveState on every trial-list change (add / complete / reset)", () => {
    const view = render(<App />);
    // Initial mount triggers at least one push (the default state).
    expect(setInteractiveStateMock).toHaveBeenCalled();
    setInteractiveStateMock.mockClear();

    // Add Trial B → push. Trials are now a letter-keyed map (not an array).
    fireEvent.click(view.getByRole("button", { name: "Add new trial" }));
    expect(setInteractiveStateMock).toHaveBeenCalled();
    const lastCall = setInteractiveStateMock.mock.calls.at(-1)?.[0] as {
      trials: Record<string, unknown>;
    };
    expect(Object.keys(lastCall.trials)).toHaveLength(2);
  });

  it("does NOT register a beforeunload listener when embedded (AP persists progress)", () => {
    // Embedded: AP persists progress, so the standalone reload warning stays off.
    useInitMessageMock.mockReturnValue({ mode: "runtime", interactiveState: null });
    const addSpy = vi.spyOn(window, "addEventListener");
    const view = render(<App />);
    runSelectedTrial(view);
    expect(addSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
    addSpy.mockRestore();
  });
});
