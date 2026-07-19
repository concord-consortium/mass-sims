import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the lara-interactive-api surface used for AP saved-state sync. vi.hoisted
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

// Default every test to standalone — App derives `isEmbedded = initMsg !== null`, and the
// real useInitMessage returns null (not undefined) with no AP parent. Embedded tests override.
beforeEach(() => {
  useInitMessageMock.mockReturnValue(null);
});

describe("Nor'easter App", () => {
  it("renders the SimulationFrame with the Nor'easter title", () => {
    const { getByRole } = render(<App />);
    expect(getByRole("heading", { level: 1, name: "Nor’easter" })).toBeInTheDocument();
  });

  it("renders the three slot regions with their canonical names", () => {
    const { getByRole } = render(<App />);
    expect(getByRole("region", { name: "Trials" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Simulation" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Data" })).toBeInTheDocument();
  });

  it("loads with an empty trial A and a New card (no B yet)", () => {
    const { getByRole, queryByRole } = render(<App />);
    expect(getByRole("option", { name: /^Trial A/ })).toBeInTheDocument();
    expect(getByRole("button", { name: "Add new trial" })).toBeInTheDocument();
    expect(queryByRole("option", { name: /^Trial B/ })).toBeNull();
  });

  it("adds an empty Trial B only when the New card is clicked", () => {
    const { getByRole, queryByRole } = render(<App />);
    expect(queryByRole("option", { name: /^Trial B/ })).toBeNull();
    fireEvent.click(getByRole("button", { name: "Add new trial" }));
    expect(getByRole("option", { name: /^Trial B/ })).toBeInTheDocument();
  });

  it("does NOT register a beforeunload listener on a clean shell (no trial progress)", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    render(<App />);
    expect(addSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
    addSpy.mockRestore();
  });

  it("shows the on-map Run prompt once setup is complete, and hides it after Run", () => {
    const { getByRole, container } = render(<App />);
    const choose = (field: RegExp, option: string) => {
      fireEvent.click(getByRole("button", { name: field }));
      fireEvent.click(getByRole("option", { name: option }));
    };

    // Not complete yet → no prompt.
    expect(container.querySelector(".nor-prompt")).toBeNull();

    // Complete all five selections → the prompt appears.
    choose(/Pathway for Land Air Mass/, "1 N/NW");
    choose(/Humidity for Land Air Mass/, "Dry");
    choose(/Temperature for Land Air Mass/, "Cold");
    choose(/Pathway for Ocean Air Mass/, "2 S/SE");
    choose(/Humidity for Ocean Air Mass/, "Humid");
    expect(container.querySelector(".nor-prompt")).toHaveTextContent(
      "Click Run to see if a nor’easter forms",
    );

    // Run → the prompt is gone (the trial has run).
    fireEvent.click(getByRole("button", { name: "Run" }));
    expect(container.querySelector(".nor-prompt")).toBeNull();
  });
});

describe("Nor'easter App — AP saved state", () => {
  beforeEach(() => {
    useInitMessageMock.mockReturnValue(null);
    setInteractiveStateMock.mockReset();
  });

  it("renders the default empty trial when no init message arrives (standalone)", () => {
    const { getByRole, queryByRole } = render(<App />);
    expect(getByRole("option", { name: /^Trial A/ })).toBeInTheDocument();
    expect(queryByRole("option", { name: /^Trial B/ })).toBeNull();
  });

  it("restores trials + selectedTrialLetter from a runtime init message's interactiveState", () => {
    // Current versioned wire shape: `{ version, trials (letter-keyed), selectedTrialLetter }`.
    const trialA = {
      landPathway: null,
      landHumidity: null,
      landTemperature: null,
      oceanPathway: null,
      oceanHumidity: null,
      outcome: null,
    };
    const trialB = { ...trialA, oceanPathway: "NE" };
    useInitMessageMock.mockReturnValue({
      mode: "runtime",
      interactiveState: { version: 1, trials: { A: trialA, B: trialB }, selectedTrialLetter: "B" },
    });
    const view = render(<App />);
    expect(view.getByRole("option", { name: /^Trial A/ })).toBeInTheDocument();
    expect(view.getByRole("option", { name: /^Trial B/ })).toBeInTheDocument();
    // The restored selection is honored — B is active, not a default fall-back to A.
    expect(view.getByRole("option", { name: /^Trial B/ })).toHaveAttribute("aria-selected", "true");
    expect(view.getByRole("option", { name: /^Trial A/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("keeps persisted trials and re-selects the first when the saved letter is absent", () => {
    // A corrupt/dangling selectedTrialLetter ("C") that names no present trial must NOT discard the
    // student's trials — the normalization reaction re-selects the first present trial instead. The
    // restored B (which a fresh store would not have) proves the saved state was applied, not reset.
    const trialA = {
      landPathway: null,
      landHumidity: null,
      landTemperature: null,
      oceanPathway: null,
      oceanHumidity: null,
      outcome: null,
    };
    const trialB = { ...trialA, oceanPathway: "NE" };
    useInitMessageMock.mockReturnValue({
      mode: "runtime",
      interactiveState: { version: 1, trials: { A: trialA, B: trialB }, selectedTrialLetter: "C" },
    });
    const view = render(<App />);
    // The persisted trials are preserved (B exists → not discarded to a fresh single-trial store)…
    expect(view.getByRole("option", { name: /^Trial B/ })).toBeInTheDocument();
    // …and selection self-heals to A.
    expect(view.getByRole("option", { name: /^Trial A/ })).toHaveAttribute("aria-selected", "true");
  });

  it("does NOT restore when the init message has interactiveState: null (first session)", () => {
    useInitMessageMock.mockReturnValue({ mode: "runtime", interactiveState: null });
    const view = render(<App />);
    expect(view.getByRole("option", { name: /^Trial A/ })).toBeInTheDocument();
    expect(view.queryByRole("option", { name: /^Trial B/ })).toBeNull();
  });

  it("calls setInteractiveState on a trial-list change (add)", () => {
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
});
