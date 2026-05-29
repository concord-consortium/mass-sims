import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./app";

describe("App", () => {
  it("renders the starter heading", () => {
    const { container } = render(<App />);
    expect(container.textContent).toContain("Mass Sims — Starter");
  });
});
