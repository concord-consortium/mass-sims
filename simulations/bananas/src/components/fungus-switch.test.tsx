import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// FungusSwitch consumes the shared useLogEvent hook directly, so mock the hook (the seam it
// uses) and assert the emitted event. vi.hoisted so the spy exists when the vi.mock factory runs.
const { logEvent } = vi.hoisted(() => ({ logEvent: vi.fn() }));
vi.mock("@concord-consortium/mass-sims-shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@concord-consortium/mass-sims-shared")>()),
  useLogEvent: () => logEvent,
}));

import { FungusSwitch } from "./fungus-switch";

const noop = () => {};

describe("FungusSwitch", () => {
  it("renders a switch accessibly named Fungus", () => {
    const { getByRole } = render(<FungusSwitch isOn={false} onChange={noop} />);
    expect(getByRole("switch", { name: "Fungus" })).toBeInTheDocument();
  });

  it("reflects the off state as unchecked with an off track", () => {
    const { getByRole, container } = render(<FungusSwitch isOn={false} onChange={noop} />);
    expect(getByRole("switch", { name: "Fungus" })).not.toBeChecked();
    expect(container.querySelector(".fungus-switch-track.on")).not.toBeInTheDocument();
  });

  it("reflects the on state as checked with an on track", () => {
    const { getByRole, container } = render(<FungusSwitch isOn={true} onChange={noop} />);
    expect(getByRole("switch", { name: "Fungus" })).toBeChecked();
    expect(container.querySelector(".fungus-switch-track.on")).toBeInTheDocument();
  });

  it("calls onChange with the new value when toggled on", () => {
    const onChange = vi.fn();
    const { getByRole } = render(<FungusSwitch isOn={false} onChange={onChange} />);
    fireEvent.click(getByRole("switch", { name: "Fungus" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when toggled off", () => {
    const onChange = vi.fn();
    const { getByRole } = render(<FungusSwitch isOn={true} onChange={onChange} />);
    fireEvent.click(getByRole("switch", { name: "Fungus" }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("emits fungus_set with the new boolean value on toggle", () => {
    const { getByRole } = render(<FungusSwitch isOn={false} onChange={noop} />);
    logEvent.mockReset();
    fireEvent.click(getByRole("switch", { name: "Fungus" }));
    expect(logEvent).toHaveBeenCalledWith("fungus_set", { value: true });
  });

  it("announces 'Fungus introduced.' in the live region when toggled on", () => {
    const { getByRole, container } = render(<FungusSwitch isOn={false} onChange={noop} />);
    fireEvent.click(getByRole("switch", { name: "Fungus" }));
    expect(container.querySelector(".fungus-switch-announcement")).toHaveTextContent(
      "Fungus introduced.",
    );
  });

  it("announces 'Fungus removed.' in the live region when toggled off", () => {
    const { getByRole, container } = render(<FungusSwitch isOn={true} onChange={noop} />);
    fireEvent.click(getByRole("switch", { name: "Fungus" }));
    expect(container.querySelector(".fungus-switch-announcement")).toHaveTextContent(
      "Fungus removed.",
    );
  });

  it("renders the switch disabled when isDisabled is true", () => {
    // jsdom's fireEvent.click bypasses native `disabled`, so onChange-suppression is verified
    // at the panel level, where the gated onSetFungus handler is the real guard.
    const { getByRole } = render(<FungusSwitch isOn={false} isDisabled onChange={noop} />);
    expect(getByRole("switch", { name: "Fungus" })).toBeDisabled();
  });
});
