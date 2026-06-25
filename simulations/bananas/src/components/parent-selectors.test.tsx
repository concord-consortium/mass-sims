import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The shared <Select> imports useLogEvent internally, so mock the log() transport — the seam a
// sim test can reach — and assert selection emits. vi.hoisted so the mock exists when vi.mock runs.
const { log } = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("@concord-consortium/lara-interactive-api", () => ({ log }));

import { type RootStoreInstance, RootStoreProvider } from "../stores/root-store";
import { createTestStore } from "../stores/test-helpers";
import { ParentSelectors } from "./parent-selectors";

function renderSelectors(store: RootStoreInstance = createTestStore()) {
  return render(
    <RootStoreProvider store={store}>
      <ParentSelectors />
    </RootStoreProvider>,
  );
}

describe("ParentSelectors", () => {
  it("renders two Select dropdowns labelled Parent 1 and Parent 2", () => {
    const { getByLabelText } = renderSelectors();
    expect(getByLabelText("Parent 1")).toBeInTheDocument();
    expect(getByLabelText("Parent 2")).toBeInTheDocument();
  });

  it("renders the × separator and two decorative thumbnail circles", () => {
    const { container } = renderSelectors();
    const separator = container.querySelector(".cross-symbol");
    expect(separator).toHaveTextContent("×");
    expect(separator).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll(".parent-circle")).toHaveLength(2);
  });

  it("renders each Select with the five parent options", () => {
    const { getByRole, getAllByRole } = renderSelectors();
    fireEvent.click(getByRole("button", { name: /Parent 1/i }));
    expect(getAllByRole("option")).toHaveLength(5);
    for (const label of ["Wild W1", "Wild W2", "Wild W3", "Cavendish C1", "Cavendish C2"]) {
      expect(getByRole("option", { name: label })).toBeInTheDocument();
    }
  });

  it("sets trial.p1 to the chosen ParentId on Parent 1 change", () => {
    const store = createTestStore();
    const { getByRole } = renderSelectors(store);
    fireEvent.click(getByRole("button", { name: /Parent 1/i }));
    fireEvent.click(getByRole("option", { name: "Wild W1" }));
    expect(store.activeTrial.p1).toBe("wild-w1");
  });

  it("sets trial.p2 to the chosen ParentId on Parent 2 change", () => {
    const store = createTestStore();
    const { getByRole } = renderSelectors(store);
    fireEvent.click(getByRole("button", { name: /Parent 2/i }));
    fireEvent.click(getByRole("option", { name: "Cavendish C1" }));
    expect(store.activeTrial.p2).toBe("cavendish-c1");
  });

  it("replaces the selects with static parent chips when the trial is locked", () => {
    const { queryByRole, getByText } = renderSelectors(
      createTestStore({ trial: { p1: "wild-w1", p2: "cavendish-c1", locked: true } }),
    );
    expect(queryByRole("button", { name: /Parent 1/i })).not.toBeInTheDocument();
    expect(queryByRole("button", { name: /Parent 2/i })).not.toBeInTheDocument();
    expect(getByText("Wild W1")).toBeInTheDocument();
    expect(getByText("Cavendish C1")).toBeInTheDocument();
  });

  it("reflects the selected parents back in the trigger labels", () => {
    const { getByRole } = renderSelectors(
      createTestStore({ trial: { p1: "wild-w1", p2: "cavendish-c1" } }),
    );
    expect(getByRole("button", { name: /Parent 1/i })).toHaveTextContent("Wild W1");
    expect(getByRole("button", { name: /Parent 2/i })).toHaveTextContent("Cavendish C1");
  });

  it("emits parent_1_set with the selected value on Parent 1 change", () => {
    const { getByRole } = renderSelectors();
    log.mockReset();
    fireEvent.click(getByRole("button", { name: /Parent 1/i }));
    fireEvent.click(getByRole("option", { name: "Wild W1" }));
    expect(log).toHaveBeenCalledWith("parent_1_set", expect.objectContaining({ value: "wild-w1" }));
  });

  it("emits parent_2_set with the selected value on Parent 2 change", () => {
    const { getByRole } = renderSelectors();
    log.mockReset();
    fireEvent.click(getByRole("button", { name: /Parent 2/i }));
    fireEvent.click(getByRole("option", { name: "Cavendish C1" }));
    expect(log).toHaveBeenCalledWith(
      "parent_2_set",
      expect.objectContaining({ value: "cavendish-c1" }),
    );
  });
});
