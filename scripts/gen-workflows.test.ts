import { describe, expect, it } from "vitest";
import { renderWorkflow } from "./gen-workflows";

describe("renderWorkflow", () => {
  it("replaces every __SIM_NAME__ occurrence", () => {
    const tpl =
      "name: Deploy __SIM_NAME__\nSIM_NAME: __SIM_NAME__\npaths:\n  - simulations/__SIM_NAME__/**\n";
    const out = renderWorkflow(tpl, "bananas");
    expect(out).toBe(
      "name: Deploy bananas\nSIM_NAME: bananas\npaths:\n  - simulations/bananas/**\n",
    );
  });

  it("leaves the template untouched when there are no markers", () => {
    const tpl = "name: CI\nruns-on: ubuntu-latest\n";
    expect(renderWorkflow(tpl, "bananas")).toBe(tpl);
  });
});
