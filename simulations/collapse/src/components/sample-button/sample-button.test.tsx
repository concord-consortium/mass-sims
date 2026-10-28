import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { takeSample } = vi.hoisted(() => ({ takeSample: vi.fn() }));
vi.mock("../../hooks/use-sample-actions", () => ({
  useSampleActions: () => ({ takeSample }),
}));

import { SampleButton } from "./sample-button";

describe("SampleButton", () => {
  it("renders an enabled button named Sample, and pressing it takes a sample", () => {
    const { getByRole } = render(<SampleButton />);
    const button = getByRole("button", { name: "Sample" });
    expect(button).not.toHaveAttribute("aria-disabled");
    fireEvent.click(button);
    expect(takeSample).toHaveBeenCalledTimes(1);
  });
});
