import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./app";

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
});
