import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The shared <Select> auto-emits via useLogEvent → lara-interactive-api's log(action, data).
// Mock that transport and assert selection emits. vi.hoisted so the mock exists when vi.mock runs.
const { log } = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("@concord-consortium/lara-interactive-api", () => ({ log }));

import { ParentSelectors, type ParentSelectorsProps } from "./parent-selectors";

const baseProps: ParentSelectorsProps = {
  p1: null,
  p2: null,
  isLocked: false,
  onSelectParent1: () => {},
  onSelectParent2: () => {},
};

describe("ParentSelectors", () => {
  it("renders two Select dropdowns labelled Parent 1 and Parent 2", () => {
    const { getByLabelText } = render(<ParentSelectors {...baseProps} />);
    expect(getByLabelText("Parent 1")).toBeInTheDocument();
    expect(getByLabelText("Parent 2")).toBeInTheDocument();
  });

  it("renders the × separator and two decorative thumbnail circles", () => {
    const { container } = render(<ParentSelectors {...baseProps} />);
    const separator = container.querySelector(".cross-symbol");
    expect(separator).toHaveTextContent("×");
    expect(separator).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll(".parent-circle")).toHaveLength(2);
  });

  it("renders each Select with the five parent options", () => {
    const { getByRole, getAllByRole } = render(<ParentSelectors {...baseProps} />);
    fireEvent.click(getByRole("button", { name: /Parent 1/i }));
    expect(getAllByRole("option")).toHaveLength(5);
    for (const label of ["Wild W1", "Wild W2", "Wild W3", "Cavendish C1", "Cavendish C2"]) {
      expect(getByRole("option", { name: label })).toBeInTheDocument();
    }
  });

  it("invokes onSelectParent1 with the chosen id when Parent 1 changes", () => {
    const onSelectParent1 = vi.fn();
    const { getByRole } = render(
      <ParentSelectors {...baseProps} onSelectParent1={onSelectParent1} />,
    );
    fireEvent.click(getByRole("button", { name: /Parent 1/i }));
    fireEvent.click(getByRole("option", { name: "Wild W1" }));
    expect(onSelectParent1).toHaveBeenCalledWith("wild-w1");
  });

  it("replaces the selects with static parent chips when isLocked is true", () => {
    const { queryByRole, getByText } = render(
      <ParentSelectors {...baseProps} p1="wild-w1" p2="cavendish-c1" isLocked />,
    );
    expect(queryByRole("button", { name: /Parent 1/i })).not.toBeInTheDocument();
    expect(queryByRole("button", { name: /Parent 2/i })).not.toBeInTheDocument();
    expect(getByText("Wild W1")).toBeInTheDocument();
    expect(getByText("Cavendish C1")).toBeInTheDocument();
  });

  it("reflects the selected parents back in the trigger labels", () => {
    const { getByRole } = render(<ParentSelectors {...baseProps} p1="wild-w1" p2="cavendish-c1" />);
    expect(getByRole("button", { name: /Parent 1/i })).toHaveTextContent("Wild W1");
    expect(getByRole("button", { name: /Parent 2/i })).toHaveTextContent("Cavendish C1");
  });

  it("emits parent_1_set with the selected value on Parent 1 change", () => {
    const { getByRole } = render(<ParentSelectors {...baseProps} />);
    log.mockReset();
    fireEvent.click(getByRole("button", { name: /Parent 1/i }));
    fireEvent.click(getByRole("option", { name: "Wild W1" }));
    expect(log).toHaveBeenCalledWith("parent_1_set", expect.objectContaining({ value: "wild-w1" }));
  });

  it("emits parent_2_set with the selected value on Parent 2 change", () => {
    const { getByRole } = render(<ParentSelectors {...baseProps} />);
    log.mockReset();
    fireEvent.click(getByRole("button", { name: /Parent 2/i }));
    fireEvent.click(getByRole("option", { name: "Cavendish C1" }));
    expect(log).toHaveBeenCalledWith(
      "parent_2_set",
      expect.objectContaining({ value: "cavendish-c1" }),
    );
  });
});
