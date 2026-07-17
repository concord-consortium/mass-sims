import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The shared <Button> imports useLogEvent (→ lara's log transport); mock the transport so the
// disabled buttons don't reach the real lara-interactive-api in jsdom.
const { log } = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("@concord-consortium/lara-interactive-api", () => ({ log }));

import { ControlBar } from "./control-bar";

// ControlBar is a pure presentational component this story (no store) — render it directly.
describe("ControlBar (default state)", () => {
  it("renders the map-view toggle locked to Street and inert", () => {
    const { getByRole } = render(<ControlBar />);
    const toggle = getByRole("switch", { name: "Map view: Street" });
    expect(toggle).not.toBeChecked();
    // Locked: activating it (click) must not change state until the behavior story wires it.
    fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();
  });

  it("renders Run and Reset Trial disabled by default", () => {
    const { getByRole } = render(<ControlBar />);
    // Disabled via aria-disabled (not the native attribute) so they stay keyboard-focusable.
    expect(getByRole("button", { name: "Run" })).toHaveAttribute("aria-disabled", "true");
    expect(getByRole("button", { name: "Reset Trial" })).toHaveAttribute("aria-disabled", "true");
  });
});
