import { fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

// FungusSwitch consumes the shared useLogEvent hook directly, so mock the hook (the seam it
// uses) and assert the emitted event. vi.hoisted so the spy exists when the vi.mock factory runs.
const { logEvent } = vi.hoisted(() => ({ logEvent: vi.fn() }));
vi.mock("@concord-consortium/mass-sims-shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@concord-consortium/mass-sims-shared")>()),
  useLogEvent: () => logEvent,
}));

import { Announcer } from "@concord-consortium/mass-sims-shared";
import { FungusSwitch } from "./fungus-switch";

const noop = () => {};

// Renders the switch under the shared <Announcer> so its narration flows through the one polite
// region.
function renderInAnnouncer(ui: ReactElement) {
  const utils = render(<Announcer>{ui}</Announcer>);
  const region = utils.container.querySelector('[aria-live="polite"]') as HTMLElement;
  return { ...utils, region };
}

describe("FungusSwitch", () => {
  it("renders a switch accessibly named Fungus", () => {
    const { getByRole } = render(<FungusSwitch isOn={false} onChange={noop} trial="A" />);
    expect(getByRole("switch", { name: "Fungus" })).toBeInTheDocument();
  });

  it("reflects the off state as unchecked with an off track", () => {
    const { getByRole, container } = render(
      <FungusSwitch isOn={false} onChange={noop} trial="A" />,
    );
    expect(getByRole("switch", { name: "Fungus" })).not.toBeChecked();
    expect(container.querySelector(".fungus-switch-track.on")).not.toBeInTheDocument();
  });

  it("reflects the on state as checked with an on track", () => {
    const { getByRole, container } = render(<FungusSwitch isOn={true} onChange={noop} trial="A" />);
    expect(getByRole("switch", { name: "Fungus" })).toBeChecked();
    expect(container.querySelector(".fungus-switch-track.on")).toBeInTheDocument();
  });

  it("calls onChange with the new value when toggled on", () => {
    const onChange = vi.fn();
    const { getByRole } = render(<FungusSwitch isOn={false} onChange={onChange} trial="A" />);
    fireEvent.click(getByRole("switch", { name: "Fungus" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when toggled off", () => {
    const onChange = vi.fn();
    const { getByRole } = render(<FungusSwitch isOn={true} onChange={onChange} trial="A" />);
    fireEvent.click(getByRole("switch", { name: "Fungus" }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("emits fungus_set with the new boolean value and trial on toggle", () => {
    const { getByRole } = render(<FungusSwitch isOn={false} onChange={noop} trial="A" />);
    logEvent.mockReset();
    fireEvent.click(getByRole("switch", { name: "Fungus" }));
    expect(logEvent).toHaveBeenCalledWith("fungus_set", { value: true, trial: "A" });
  });

  it("announces 'Fungus introduced.' through the shared announcer when toggled on", () => {
    const { getByRole, region } = renderInAnnouncer(
      <FungusSwitch isOn={false} onChange={noop} trial="A" />,
    );
    fireEvent.click(getByRole("switch", { name: "Fungus" }));
    expect(region).toHaveTextContent("Fungus introduced.");
  });

  it("announces 'Fungus removed.' through the shared announcer when toggled off", () => {
    const { getByRole, region } = renderInAnnouncer(
      <FungusSwitch isOn={true} onChange={noop} trial="A" />,
    );
    fireEvent.click(getByRole("switch", { name: "Fungus" }));
    expect(region).toHaveTextContent("Fungus removed.");
  });

  it("toggles once when Enter is pressed", () => {
    const onChange = vi.fn();
    const { getByRole } = render(<FungusSwitch isOn={false} onChange={onChange} trial="A" />);
    const sw = getByRole("switch", { name: "Fungus" });
    sw.focus();
    fireEvent.keyDown(sw, { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("toggles off when Enter is pressed while on", () => {
    const onChange = vi.fn();
    const { getByRole } = render(<FungusSwitch isOn={true} onChange={onChange} trial="A" />);
    const sw = getByRole("switch", { name: "Fungus" });
    sw.focus();
    fireEvent.keyDown(sw, { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("ignores auto-repeated Enter keydowns so a held key doesn't oscillate the toggle", () => {
    const onChange = vi.fn();
    const { getByRole } = render(<FungusSwitch isOn={false} onChange={onChange} trial="A" />);
    const sw = getByRole("switch", { name: "Fungus" });
    sw.focus();
    fireEvent.keyDown(sw, { key: "Enter", repeat: true });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("Enter handler stays inert for Space (Space still toggles once via the native path)", () => {
    // react-aria handles Space via the native checkbox (modeled by click in jsdom). Our added
    // handler is Enter-only, so a Space keydown must NOT itself call onChange, and the native
    // toggle must still fire exactly once — i.e. no double toggle.
    const onChange = vi.fn();
    const { getByRole } = render(<FungusSwitch isOn={false} onChange={onChange} trial="A" />);
    const sw = getByRole("switch", { name: "Fungus" });
    sw.focus();
    fireEvent.keyDown(sw, { key: " " });
    fireEvent.keyUp(sw, { key: " " });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does not toggle when Enter is pressed on a disabled switch", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <FungusSwitch isOn={false} isDisabled onChange={onChange} trial="A" />,
    );
    const sw = getByRole("switch", { name: "Fungus" });
    fireEvent.keyDown(sw, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("exposes a keyboard-focusable switch", () => {
    const { getByRole } = render(<FungusSwitch isOn={false} onChange={noop} trial="A" />);
    const sw = getByRole("switch", { name: "Fungus" });
    sw.focus();
    expect(sw).toHaveFocus();
  });

  it("marks the locked switch aria-disabled but keeps it focusable and inert", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <FungusSwitch isOn={false} isDisabled onChange={onChange} trial="A" />,
    );
    const sw = getByRole("switch", { name: "Fungus" });

    // Locked via aria-disabled, not a native `disabled` attribute (jest-dom's toBeDisabled only
    // reads native disabled, so not.toBeDisabled() passes here).
    expect(sw).toHaveAttribute("aria-disabled", "true");
    expect(sw).not.toBeDisabled();

    // Still in the tab order: a native-disabled input can't take focus, so this locks in the fix.
    sw.focus();
    expect(sw).toHaveFocus();

    // Toggling is blocked across every path: click, Enter keydown, and the native Space path.
    fireEvent.click(sw);
    fireEvent.keyDown(sw, { key: "Enter" });
    fireEvent.keyDown(sw, { key: " " });
    fireEvent.keyUp(sw, { key: " " });
    expect(onChange).not.toHaveBeenCalled();
  });
});
