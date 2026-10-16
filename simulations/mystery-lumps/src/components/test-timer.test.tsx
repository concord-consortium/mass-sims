import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { paint, stubFrames } from "../test-utils/frames";
import { RUN_MS, TestTimer } from "./test-timer";

beforeEach(stubFrames);

afterEach(() => vi.unstubAllGlobals());

describe("TestTimer", () => {
  it("does not advance while no test is running", () => {
    const { getByRole } = render(<TestTimer test="vinegar" setting={null} running={false} />);
    paint(0);
    paint(3000);
    expect(getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("counts sim time out as the frames go by", () => {
    const { getByRole } = render(<TestTimer test="vinegar" setting={null} running={true} />);
    // First frame establishes the clock; its delta is zero by design.
    paint(0);
    expect(getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    // Half the real run time is half the sim span: 60 of the vinegar's 120 seconds.
    paint(RUN_MS / 2);
    expect(getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
  });

  it("stops at the full span rather than running past it", () => {
    const { getByRole } = render(<TestTimer test="vinegar" setting={null} running={true} />);
    paint(0);
    paint(RUN_MS * 3);
    expect(getByRole("progressbar")).toHaveAttribute("aria-valuenow", "120");
  });

  it("scales the same seven seconds to the lamp's much longer span", () => {
    const { getByRole } = render(<TestTimer test="lamp" setting="fortnight" running={true} />);
    paint(0);
    paint(RUN_MS / 2);
    // Seven real seconds either way; a fortnight is just counted in bigger numbers.
    expect(getByRole("progressbar")).toHaveAttribute("aria-valuenow", "604800");
    expect(getByRole("progressbar")).toHaveAttribute("aria-valuetext", "7 d of 14 d");
  });
});
