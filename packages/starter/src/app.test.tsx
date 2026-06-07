import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./app";

// Run the currently-selected trial to completion by shortening it and stepping through.
function runSelectedTrial(view: ReturnType<typeof render>, frames = 2) {
  fireEvent.change(view.getByLabelText(/frames per trial/i), { target: { value: String(frames) } });
  const stepButton = view.getByRole("button", { name: /step/i });
  for (let i = 0; i < frames; i++) fireEvent.click(stepButton);
}

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
    expect(getByRole("button", { name: "Trial A" })).toBeInTheDocument();
    expect(getByRole("button", { name: "New trial" })).toBeInTheDocument();
    expect(queryByRole("button", { name: "Trial B" })).toBeNull();
    // Empty trial → no recorded stats yet.
    expect(queryByText(/avg \d/i)).toBeNull();
  });

  it("running the selected trial fills its card without adding a new one", () => {
    const view = render(<App />);
    runSelectedTrial(view);
    // Trial A's card now shows recorded stats…
    expect(view.getByText(/avg \d/i)).toBeInTheDocument();
    // …and no Trial B appeared (completion updates the selected trial, not appends).
    expect(view.queryByRole("button", { name: "Trial B" })).toBeNull();
  });

  it("adds an empty Trial B only when the New card is clicked", () => {
    const { getByRole, queryByRole } = render(<App />);
    expect(queryByRole("button", { name: "Trial B" })).toBeNull();
    fireEvent.click(getByRole("button", { name: "New trial" }));
    expect(getByRole("button", { name: "Trial B" })).toBeInTheDocument();
  });

  it("resets a completed trial back to empty without deleting the card", () => {
    const view = render(<App />);
    runSelectedTrial(view);
    expect(view.getByText(/avg \d/i)).toBeInTheDocument();
    // The selected card's reset affordance clears it (trials are reset, not deleted).
    fireEvent.click(view.getByRole("button", { name: "Reset trial A" }));
    expect(view.getByRole("button", { name: "Trial A" })).toBeInTheDocument();
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
