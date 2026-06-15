import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./app";

describe("Bananas App", () => {
  it("renders the SimulationFrame title", () => {
    const { getByRole } = render(<App />);
    expect(getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders the three slot regions with their canonical names", () => {
    const { getByRole } = render(<App />);
    expect(getByRole("region", { name: "Trials" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Simulation" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Data" })).toBeInTheDocument();
  });
});
