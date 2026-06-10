import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logEventSpy = vi.fn();
vi.mock("../../hooks/use-log-event", () => ({ useLogEvent: () => logEventSpy }));

import { Switch } from "./switch";

describe("Switch", () => {
  beforeEach(() => logEventSpy.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("renders with a label", () => {
    const { getByText, getByRole } = render(<Switch>Sound on</Switch>);
    expect(getByText("Sound on")).toBeInTheDocument();
    expect(getByRole("switch")).toBeInTheDocument();
  });

  it("applies the .switch root class", () => {
    const { container } = render(<Switch>Sound on</Switch>);
    expect(container.querySelector(".switch")).toBeInTheDocument();
  });

  it("fires onChange on toggle", () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Switch onChange={onChange}>Sound on</Switch>);
    fireEvent.click(getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("auto-emits a log event with the new value and actionParams when action is supplied", () => {
    const { getByRole } = render(
      <Switch action="sound_set" actionParams={{ trial: "A" }}>
        Sound on
      </Switch>,
    );
    fireEvent.click(getByRole("switch"));
    expect(logEventSpy).toHaveBeenCalledWith(
      "sound_set",
      expect.objectContaining({ value: true, trial: "A" }),
    );
  });

  it("does NOT emit a log event when action is omitted", () => {
    const { getByRole } = render(<Switch>Sound on</Switch>);
    fireEvent.click(getByRole("switch"));
    expect(logEventSpy).not.toHaveBeenCalled();
  });

  it("forwards isDisabled", () => {
    const { getByRole } = render(<Switch isDisabled>Sound on</Switch>);
    expect(getByRole("switch")).toBeDisabled();
  });
});
