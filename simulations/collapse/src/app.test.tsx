import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the lara-interactive-api surface used for AP saved-state sync. vi.hoisted so the mocks
// exist when vi.mock runs; defaults to standalone (null), overridden per-case.
const { useInitMessageMock, setInteractiveStateMock } = vi.hoisted(() => ({
  useInitMessageMock: vi.fn(),
  setInteractiveStateMock: vi.fn(),
}));
vi.mock("@concord-consortium/lara-interactive-api", () => ({
  useInitMessage: useInitMessageMock,
  setInteractiveState: setInteractiveStateMock,
}));

import { App } from "./app";

beforeEach(() => {
  useInitMessageMock.mockReturnValue(null);
  setInteractiveStateMock.mockReset();
});

describe("Collapse App", () => {
  it("renders the SimulationFrame with the Collapse title", () => {
    const { getByRole } = render(<App />);
    expect(getByRole("heading", { level: 1, name: "Collapse" })).toBeInTheDocument();
  });

  it("renders the three slot regions", () => {
    const { getByRole } = render(<App />);
    expect(getByRole("region", { name: "Trials" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Simulation" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Data" })).toBeInTheDocument();
  });

  it("loads with an empty trial A and a New card (no B yet)", () => {
    const { getByRole, queryByRole } = render(<App />);
    expect(getByRole("button", { name: "Trial A" })).toBeInTheDocument();
    expect(getByRole("button", { name: "New trial" })).toBeInTheDocument();
    expect(queryByRole("button", { name: "Trial B" })).toBeNull();
  });

  it("adds an empty Trial B only when the New card is clicked", () => {
    const { getByRole, queryByRole } = render(<App />);
    expect(queryByRole("button", { name: "Trial B" })).toBeNull();
    fireEvent.click(getByRole("button", { name: "New trial" }));
    expect(getByRole("button", { name: "Trial B" })).toBeInTheDocument();
  });

  it("reflects a setting change on the selected trial's card", () => {
    const { getByRole, getAllByText } = render(<App />);
    // Default settings include "Wet" — shown on Trial A's card.
    expect(getAllByText("Wet").length).toBeGreaterThan(0);
    // Toggle the wetness switch to Dry; the card text follows.
    fireEvent.click(getByRole("switch", { name: /wet climate/i }));
    expect(getAllByText("Dry").length).toBeGreaterThan(0);
  });

  it("restores trials + selectedId from a runtime init message", () => {
    const trialA = {
      id: "saved-A",
      input: { location: "bowling-green", wetness: "wet", soil: "limestone" },
      output: { collapsed: true, roofErosionPct: 100 },
      finalTransient: { year: 2014 },
    };
    const trialB = {
      id: "saved-B",
      input: { location: "bowling-green", wetness: "dry", soil: "granite" },
      output: null,
      finalTransient: null,
    };
    useInitMessageMock.mockReturnValue({
      mode: "runtime",
      interactiveState: { trials: [trialA, trialB], selectedId: "saved-B" },
    });
    const { getByRole } = render(<App />);
    expect(getByRole("button", { name: "Trial A" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Trial B" })).toBeInTheDocument();
  });

  it("pushes state via setInteractiveState when a trial is added", () => {
    const { getByRole } = render(<App />);
    setInteractiveStateMock.mockClear();
    fireEvent.click(getByRole("button", { name: "New trial" }));
    expect(setInteractiveStateMock).toHaveBeenCalled();
    const last = setInteractiveStateMock.mock.calls.at(-1)?.[0] as { trials: unknown[] };
    expect(last.trials).toHaveLength(2);
  });
});
