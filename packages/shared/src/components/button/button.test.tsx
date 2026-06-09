import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` is hoisted above the module body, so the spy must be created via
// `vi.hoisted` to exist when the factory runs (Vitest 4 hoists `vi.mock` above
// plain top-level `const`s).
const { logEventSpy } = vi.hoisted(() => ({ logEventSpy: vi.fn() }));
vi.mock("../../hooks/use-log-event", () => ({
  useLogEvent: () => logEventSpy,
}));

import { Button } from "./button";

describe("Button", () => {
  beforeEach(() => logEventSpy.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("renders its children as the label", () => {
    const { getByRole } = render(<Button>Play</Button>);
    expect(getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("applies the .button class", () => {
    const { getByRole } = render(<Button>Play</Button>);
    expect(getByRole("button")).toHaveClass("button");
  });

  it("forwards onPress and calls it on click", () => {
    const onPress = vi.fn();
    const { getByRole } = render(<Button onPress={onPress}>Play</Button>);
    fireEvent.click(getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("forwards isDisabled to the underlying control", () => {
    const onPress = vi.fn();
    const { getByRole } = render(
      <Button onPress={onPress} isDisabled>
        Play
      </Button>,
    );
    expect(getByRole("button")).toBeDisabled();
    fireEvent.click(getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("auto-emits a log event when action is supplied", () => {
    const { getByRole } = render(<Button action="play_pressed">Play</Button>);
    fireEvent.click(getByRole("button"));
    expect(logEventSpy).toHaveBeenCalledWith("play_pressed", undefined);
  });

  it("forwards the actionParams object to the log event", () => {
    const { getByRole } = render(
      <Button action="trial_reset" actionParams={{ trial: "A" }}>
        Reset
      </Button>,
    );
    fireEvent.click(getByRole("button"));
    expect(logEventSpy).toHaveBeenCalledWith("trial_reset", { trial: "A" });
  });

  it("does NOT emit a log event when action is omitted", () => {
    const { getByRole } = render(<Button>Play</Button>);
    fireEvent.click(getByRole("button"));
    expect(logEventSpy).not.toHaveBeenCalled();
  });

  it("does NOT emit a log event when disabled (click suppressed)", () => {
    const { getByRole } = render(
      <Button action="play_pressed" isDisabled>
        Play
      </Button>,
    );
    fireEvent.click(getByRole("button"));
    expect(logEventSpy).not.toHaveBeenCalled();
  });

  it("composes a custom className with the .button class", () => {
    const { getByRole } = render(<Button className="extra-class">Play</Button>);
    expect(getByRole("button")).toHaveClass("button");
    expect(getByRole("button")).toHaveClass("extra-class");
  });
});
