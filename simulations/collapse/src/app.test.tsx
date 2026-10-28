import { act, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
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

// Nothing in the UI can take a sample yet, so tests that need samples restore them (trial A, plus
// any `extraTrials`) through AP saved state. This makes the sim embedded, because a restore
// only arrives in an AP init message. Returns that message and trial A.
function restoreTrialAWithSamples({
  selected = "A",
  extraTrials = {},
}: {
  selected?: string;
  extraTrials?: object;
} = {}) {
  const trialA = {
    samples: [{ id: 1, years: 200000, rate: 20.5, roof: 8800 }],
    nextSampleId: 2,
  };
  const initMsg = {
    mode: "runtime",
    interactiveState: {
      version: 2,
      trials: { A: trialA, ...extraTrials },
      selectedTrialLetter: selected,
    },
  };
  useInitMessageMock.mockReturnValue(initMsg);
  return { initMsg, trialA };
}

/** The trial options' "Trial X" names, in rendered order. */
function trialOptions(view: ReturnType<typeof render>) {
  return view.getAllByRole("option").map((o) => o.getAttribute("aria-label")?.slice(0, 7));
}

/** Whether the selected trial has samples, read from whether its reset is enabled. */
function selectedHasSamples(view: ReturnType<typeof render>, letter: string) {
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
    expect(selectedHasSamples(view, "A")).toBe(false);
  });

  it("resets a completed trial back to empty without deleting the card", () => {
    restoreTrialAWithSamples();
    const view = render(<App />);
    expect(selectedHasSamples(view, "A")).toBe(true);
    fireEvent.click(view.getByRole("button", { name: "Reset trial A" }));
    expect(view.getByRole("option", { name: /^Trial A/ })).toBeInTheDocument();
    expect(selectedHasSamples(view, "A")).toBe(false);
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
    const trialB = { samples: [], nextSampleId: 1 };
    restoreTrialAWithSamples({ selected: "B", extraTrials: { B: trialB } });
    const view = render(<App />);
    expect(trialOptions(view)).toEqual(["Trial A", "Trial B", "Trial C", "Trial D"]);
    expect(view.getByRole("option", { name: /^Trial B/ })).toHaveAttribute("aria-selected", "true");
    expect(view.getByRole("option", { name: /^Trial A/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(selectedHasSamples(view, "B")).toBe(false);
    // Trial A's saved samples were restored too.
    fireEvent.click(view.getByRole("option", { name: /^Trial A/ }));
    expect(selectedHasSamples(view, "A")).toBe(true);
  });

  it("keeps persisted trials and selects A when the saved letter is outside A–D", () => {
    // A bad selected letter must not discard the student's trials.
    restoreTrialAWithSamples({ selected: "E" });
    const view = render(<App />);
    expect(view.getByRole("option", { name: /^Trial A/ })).toHaveAttribute("aria-selected", "true");
    expect(selectedHasSamples(view, "A")).toBe(true);
  });

  it("does NOT restore when the init message has interactiveState: null (first session)", () => {
    useInitMessageMock.mockReturnValue({ mode: "runtime", interactiveState: null });
    const view = render(<App />);
    expect(trialOptions(view)).toEqual(["Trial A", "Trial B", "Trial C", "Trial D"]);
    expect(selectedHasSamples(view, "A")).toBe(false);
  });

  it("calls setInteractiveState on every trial-list change (restore / reset)", () => {
    restoreTrialAWithSamples();
    const view = render(<App />);
    // Mount and restore push the restored state.
    expect(setInteractiveStateMock).toHaveBeenCalled();
    const restored = setInteractiveStateMock.mock.calls.at(-1)?.[0] as {
      trials: Record<string, { samples: unknown[] }>;
    };
    expect(Object.keys(restored.trials)).toEqual(["A", "B", "C", "D"]);
    expect(restored.trials.A.samples).toHaveLength(1);

    setInteractiveStateMock.mockClear();
    fireEvent.click(view.getByRole("button", { name: "Reset trial A" }));
    expect(setInteractiveStateMock).toHaveBeenCalled();
    const reset = setInteractiveStateMock.mock.calls.at(-1)?.[0] as {
      trials: Record<string, { samples: unknown[] }>;
    };
    expect(reset.trials.A.samples).toEqual([]);
  });

  it("waits for the init message before sending state to AP, then sends the restored state first", () => {
    const { initMsg, trialA } = restoreTrialAWithSamples();
    // Stateful, like the real hook: App is memoized, so a rerender with identical props would
    // never re-read the mock. `deliver` sends the late init message.
    let deliver: (msg: unknown) => void = () => {};
    useInitMessageMock.mockImplementation(() => {
      const [msg, setMsg] = useState<unknown>(null);
      deliver = setMsg;
      return msg;
    });
    render(<App />);
    expect(setInteractiveStateMock).not.toHaveBeenCalled();
    act(() => deliver(initMsg));
    const first = setInteractiveStateMock.mock.calls[0]?.[0] as {
      trials: Record<string, { samples: unknown[] }>;
    };
    expect(first.trials.A.samples).toEqual(trialA.samples);
  });

  it("keeps the timeline value when saved state arrives after the student has moved it", () => {
    const { initMsg } = restoreTrialAWithSamples();
    let deliver: (msg: unknown) => void = () => {};
    useInitMessageMock.mockImplementation(() => {
      const [msg, setMsg] = useState<unknown>(null);
      deliver = setMsg;
      return msg;
    });
    const view = render(<App />);
    const slider = view.getByRole("slider", { name: "Years before collapse" });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    act(() => deliver(initMsg));
    expect(selectedHasSamples(view, "A")).toBe(true);
    expect(view.getByRole("slider", { name: "Years before collapse" })).toHaveAttribute(
      "aria-valuenow",
      "150000",
    );
  });

  it("does NOT call setInteractiveState when the timeline value changes", () => {
    // Embedded, because the app sends state to AP only after an init message.
    restoreTrialAWithSamples();
    const { getByRole } = render(<App />);
    expect(setInteractiveStateMock).toHaveBeenCalled();
    const slider = getByRole("slider", { name: "Years before collapse" });
    setInteractiveStateMock.mockClear();
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.click(getByRole("button", { name: "Later, fewer years before collapse" }));
    expect(slider).toHaveAttribute("aria-valuenow", "100000");
    expect(setInteractiveStateMock).not.toHaveBeenCalled();
  });

  it("does NOT register a beforeunload listener when embedded (AP persists progress)", () => {
    // Embedded with progress: AP saves it, so there is no reload warning.
    restoreTrialAWithSamples();
    const addSpy = vi.spyOn(window, "addEventListener");
    const view = render(<App />);
    expect(selectedHasSamples(view, "A")).toBe(true);
    expect(addSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
    addSpy.mockRestore();
  });
});
