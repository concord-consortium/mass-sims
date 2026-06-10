import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logEventSpy = vi.fn();
vi.mock("../../hooks/use-log-event", () => ({ useLogEvent: () => logEventSpy }));

import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  beforeEach(() => logEventSpy.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("renders with a label", () => {
    const { getByText, getByRole } = render(<Checkbox>Show grid</Checkbox>);
    expect(getByText("Show grid")).toBeInTheDocument();
    expect(getByRole("checkbox")).toBeInTheDocument();
  });

  it("applies the .checkbox root class", () => {
    const { container } = render(<Checkbox>Show grid</Checkbox>);
    expect(container.querySelector(".checkbox")).toBeInTheDocument();
  });

  it("fires onChange on toggle", () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Checkbox onChange={onChange}>Show grid</Checkbox>);
    fireEvent.click(getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("auto-emits a log event with the new value and actionParams when action is supplied", () => {
    const { getByRole } = render(
      <Checkbox action="grid_set" actionParams={{ trial: "A" }}>
        Show grid
      </Checkbox>,
    );
    fireEvent.click(getByRole("checkbox"));
    expect(logEventSpy).toHaveBeenCalledWith(
      "grid_set",
      expect.objectContaining({ value: true, trial: "A" }),
    );
  });

  it("does NOT emit a log event when action is omitted", () => {
    const { getByRole } = render(<Checkbox>Show grid</Checkbox>);
    fireEvent.click(getByRole("checkbox"));
    expect(logEventSpy).not.toHaveBeenCalled();
  });

  it("forwards isDisabled", () => {
    const { getByRole } = render(<Checkbox isDisabled>Show grid</Checkbox>);
    expect(getByRole("checkbox")).toBeDisabled();
  });

  it("renders the indeterminate visual when isIndeterminate is set", () => {
    const { container } = render(<Checkbox isIndeterminate>Show grid</Checkbox>);
    expect(container.querySelector(".checkbox[data-indeterminate] .indicator")).toBeInTheDocument();
  });
});
