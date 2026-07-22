import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { START_YEAR } from "../model/collapse";
import type { SimInput } from "../model/types";
import { SimulationView } from "./simulation-view";

const input: SimInput = {
  location: "bowling-green",
  wetness: "wet",
  soil: "limestone",
};

function renderView(overrides: Partial<React.ComponentProps<typeof SimulationView>> = {}) {
  const props = {
    input,
    year: START_YEAR,
    isPlaying: false,
    inputsLocked: false,
    trialLabel: "A",
    onChangeInput: vi.fn(),
    onPlayPause: vi.fn(),
    onScrubYear: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<SimulationView {...props} />) };
}

describe("SimulationView", () => {
  it("renders the cross-section, three setting switches, a year slider, and Play", () => {
    const { getByRole, getAllByRole } = renderView();
    expect(getByRole("img", { name: /cross-section/i })).toBeInTheDocument();
    // terrain, wetness, soil
    expect(getAllByRole("switch")).toHaveLength(3);
    expect(getByRole("slider", { name: /year/i })).toBeInTheDocument();
    expect(getByRole("button", { name: /play/i })).toBeInTheDocument();
  });

  it("toggling the wetness switch reports the new setting", () => {
    const onChangeInput = vi.fn();
    const { getByRole } = renderView({ onChangeInput });
    // The wetness switch is labeled by its current state ("Wet climate").
    fireEvent.click(getByRole("switch", { name: /wet climate/i }));
    expect(onChangeInput).toHaveBeenCalledWith({ wetness: "dry" });
  });

  it("disables the setting switches when inputs are locked", () => {
    const { getByRole } = renderView({ inputsLocked: true });
    expect(getByRole("switch", { name: /wet climate/i })).toBeDisabled();
  });
});
