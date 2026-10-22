import { Announcer } from "@concord-consortium/mass-sims-shared";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TIMELINE_VALUES } from "../../model/timeline";
import { createRootStore, RootStoreProvider } from "../../stores/root-store";
import { YearStepper } from "./year-stepper";

function setup() {
  const store = createRootStore();
  const view = render(
    <RootStoreProvider store={store}>
      <Announcer>
        <YearStepper />
      </Announcer>
    </RootStoreProvider>,
  );
  return {
    store,
    view,
    earlier: view.getByRole("button", { name: "Earlier, more years before collapse" }),
    later: view.getByRole("button", { name: "Later, fewer years before collapse" }),
    display: view.container.querySelector(".collapse-step-value") as HTMLElement,
    region: view.container.querySelector('[aria-live="polite"]') as HTMLElement,
  };
}

describe("YearStepper", () => {
  it("steps the store and announces the new value", () => {
    const { store, earlier, later, region } = setup();
    fireEvent.click(later);
    expect(store.ui.sampleYears).toBe(150000);
    expect(region).toHaveTextContent("150,000 years before collapse.");
    fireEvent.click(later);
    fireEvent.click(earlier);
    expect(store.ui.sampleYears).toBe(150000);
  });

  it("marks each arrow aria-disabled at its end, and keeps it focusable", () => {
    const { store, earlier, later } = setup();
    expect(earlier).toHaveAttribute("aria-disabled", "true");
    expect(earlier).not.toBeDisabled();
    expect(later).not.toHaveAttribute("aria-disabled");
    fireEvent.click(earlier);
    expect(store.ui.timelineIndex).toBe(0);

    act(() => store.ui.setTimelineIndex(TIMELINE_VALUES.length - 1));
    expect(later).toHaveAttribute("aria-disabled", "true");
    expect(later).not.toBeDisabled();
    expect(earlier).not.toHaveAttribute("aria-disabled");
    earlier.focus();
    expect(earlier).toHaveFocus();
    later.focus();
    expect(later).toHaveFocus();
  });

  it("shows the value with grouping, hidden from assistive tech", () => {
    const { store, display } = setup();
    expect(display).toHaveTextContent("200,000");
    expect(display).toHaveAttribute("aria-hidden", "true");
    act(() => store.ui.setTimelineIndex(1));
    expect(display).toHaveTextContent("150,000");
    act(() => store.ui.setTimelineIndex(TIMELINE_VALUES.length - 1));
    expect(display).toHaveTextContent("0");
  });
});
