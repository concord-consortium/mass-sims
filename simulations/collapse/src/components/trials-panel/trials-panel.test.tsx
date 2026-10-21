import { Announcer } from "@concord-consortium/mass-sims-shared";
import { act, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// TrialsPanel consumes useLogEvent directly, so mock the hook (the seam it uses) while preserving the
// real shared exports it also imports (TrialCard, constants). vi.hoisted so the spy exists when
// vi.mock runs.
const { logEvent } = vi.hoisted(() => ({ logEvent: vi.fn() }));
vi.mock("@concord-consortium/mass-sims-shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@concord-consortium/mass-sims-shared")>()),
  useLogEvent: () => logEvent,
}));

import type { SimOutput, SimTransient } from "../../model/types";
import {
  createRootStore,
  type RootStoreInstance,
  RootStoreProvider,
} from "../../stores/root-store";
import { TrialsPanel } from "./trials-panel";

const OUTPUT: SimOutput = { avgDistance: 12.3, stdDevDistance: 2.1, avgDistanceSeries: [1, 2, 3] };
const TRANSIENT: SimTransient = {
  frame: 200,
  walkers: [{ x: 1, y: 1 }],
  avgDistanceSeries: [1, 2, 3],
};

function renderPanel(store: RootStoreInstance) {
  // Under the shared <Announcer> so reset narration can be asserted.
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RootStoreProvider store={store}>
      <Announcer>{children}</Announcer>
    </RootStoreProvider>
  );
  const utils = render(<TrialsPanel />, { wrapper });
  const region = utils.container.querySelector('[aria-live="polite"]') as HTMLElement;
  return { region, ...utils };
}

describe("TrialsPanel — listbox structure", () => {
  it("renders a vertical listbox labeled Trials (single-select, no aria-multiselectable)", () => {
    const { getByRole } = renderPanel(createRootStore());
    const listbox = getByRole("listbox", { name: "Trials" });
    expect(listbox).toHaveAttribute("aria-orientation", "vertical");
    expect(listbox).not.toHaveAttribute("aria-multiselectable");
  });

  it("renders one role=option per trial (A–D), with aria-selected tracking selection", () => {
    const { getAllByRole } = renderPanel(createRootStore());
    const options = getAllByRole("option");
    expect(options).toHaveLength(4);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");
  });

  it("the listbox owns ONLY option cards — the reset is outside it, and there is no + New card", () => {
    const { getByRole, queryByRole } = renderPanel(createRootStore());
    const listbox = getByRole("listbox", { name: "Trials" });
    expect(listbox.contains(getByRole("button", { name: "Reset trial A" }))).toBe(false);
    expect(queryByRole("button", { name: "Add new trial" })).toBeNull();
    // Every direct child is a presentational (role="none") TrialCard wrapper, so the option button
    // inside each reads as a direct child of the listbox — no unannotated <div> in the owned chain.
    for (const child of Array.from(listbox.children)) {
      expect(child).toHaveAttribute("role", "none");
    }
  });

  it("applies roving tabindex: only the selected option is tabbable, then its reset", () => {
    const store = createRootStore();
    store.activeTrial.setOutput(OUTPUT, TRANSIENT); // the reset is enabled once A has output
    const { getAllByRole, getByRole } = renderPanel(store);
    const options = getAllByRole("option");
    expect(options[0]).toHaveAttribute("tabindex", "0");
    expect(options[1]).toHaveAttribute("tabindex", "-1");
    expect(options[2]).toHaveAttribute("tabindex", "-1");
    expect(options[3]).toHaveAttribute("tabindex", "-1");
    // The reset is the panel's second tab stop (the shared hook's `resetTabIndex`).
    expect(getByRole("button", { name: "Reset trial A" })).toHaveAttribute("tabindex", "0");
  });
});

describe("TrialsPanel — narration", () => {
  it("announces 'Trial A reset.' when the panel reset is pressed", () => {
    // Seed A with output so its (selected-trial) reset is enabled.
    const store = createRootStore();
    act(() => store.activeTrial.setOutput(OUTPUT, TRANSIENT));
    const { getByRole, region } = renderPanel(store);
    fireEvent.click(getByRole("button", { name: "Reset trial A" }));
    expect(region).toHaveTextContent("Trial A reset.");
  });
});

describe("TrialsPanel — enriched aria-label and card body", () => {
  it("labels each card with its letter and conditions", () => {
    const { getAllByRole } = renderPanel(createRootStore());
    expect(getAllByRole("option").map((o) => o.getAttribute("aria-label"))).toEqual([
      "Trial A. Limestone, Dry, fewer than 10 rainy days per year. Not yet sampled",
      "Trial B. Limestone, Wet, more than 50 rainy days per year. Not yet sampled",
      "Trial C. Granite, Dry, fewer than 10 rainy days per year. Not yet sampled",
      "Trial D. Granite, Wet, more than 50 rainy days per year. Not yet sampled",
    ]);
  });

  it("shows the rock type, moisture, and moisture note on the card (hidden from screen readers)", () => {
    const { getAllByRole } = renderPanel(createRootStore());
    const body = getAllByRole("option")[3].querySelector(".trial-card-body");
    expect(body).toHaveAttribute("aria-hidden", "true");
    expect(body).toHaveTextContent("Granite");
    expect(body).toHaveTextContent("Wet");
    expect(body).toHaveTextContent(">50 rainy days/yr");
  });
});

describe("TrialsPanel — trial-list logging", () => {
  it("logs trial_selected with the previous letter on card click", () => {
    const { getAllByRole } = renderPanel(createRootStore());
    logEvent.mockReset();
    fireEvent.click(getAllByRole("option")[1]);
    expect(logEvent).toHaveBeenCalledWith("trial_selected", { trial: "B", previous: "A" });
  });

  it("emits nothing when the already-selected card is clicked (no-op skip)", () => {
    const { getAllByRole } = renderPanel(createRootStore());
    logEvent.mockReset();
    fireEvent.click(getAllByRole("option")[0]); // A is selected by default
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("logs trial_reset for the selected trial via the panel reset button", () => {
    const store = createRootStore();
    store.activeTrial.setOutput(OUTPUT, TRANSIENT); // give A progress so reset is enabled
    const { getByRole } = renderPanel(store);
    logEvent.mockReset();
    fireEvent.click(getByRole("button", { name: "Reset trial A" }));
    expect(logEvent).toHaveBeenCalledWith("trial_reset", { trial: "A" });
  });
});

describe("TrialsPanel — scroll selected into view", () => {
  it("scrolls the newly selected trial card into view on click", () => {
    // jsdom doesn't implement scrollIntoView, so define it before spying — capture the original
    // and restore it afterward so the stub doesn't leak into later tests.
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = () => {};
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const { getAllByRole } = renderPanel(createRootStore());
    scrollSpy.mockClear();
    fireEvent.click(getAllByRole("option")[1]);
    expect(scrollSpy).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
    scrollSpy.mockRestore();
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });
});

describe("TrialsPanel — keyboard-nav wiring", () => {
  // The ring itself (ArrowDown/Up/Home/End across the cards, wrapping) is BEHAVIOR owned by the
  // shared hook and tested once, sim-agnostically, in
  // packages/shared/src/hooks/use-trials-keyboard-nav.test.tsx. Don't re-test it here.
  //
  // These tests prove only that THIS panel wires the hook up: the handlers reach the listbox (and
  // the `.trial-card` class the hook selects on), selection goes through the logging funnel, and
  // `canAddTrial: false` reaches the hook — the End / wrap test is the one that would catch the
  // ring still reserving a `+ New` slot. The hook's tabIndexes landing on the cards and the reset
  // are checked in the roving-tabindex test above.
  it("ArrowDown on a card selects the next one and logs it (handler wired to the listbox)", () => {
    const store = createRootStore();
    const { getAllByRole } = renderPanel(store);
    logEvent.mockReset();
    fireEvent.keyDown(getAllByRole("option")[0], { key: "ArrowDown" });
    expect(store.ui.selectedTrialLetter).toBe("B");
    expect(logEvent).toHaveBeenCalledWith("trial_selected", { trial: "B", previous: "A" });
  });

  it("End selects D and ArrowDown from D wraps to A (no + New member in the ring)", () => {
    const store = createRootStore();
    const { getAllByRole } = renderPanel(store);
    fireEvent.keyDown(getAllByRole("option")[0], { key: "End" });
    expect(store.ui.selectedTrialLetter).toBe("D");
    fireEvent.keyDown(getAllByRole("option")[3], { key: "ArrowDown" });
    expect(store.ui.selectedTrialLetter).toBe("A");
  });

  it("ignores Enter in the listbox handler (native button activation selects — no double)", () => {
    // The listbox onKeyDown handles only arrows/Home/End; Enter/Space are the option button's
    // native job, so a keydown Enter on an unselected option does NOT select via the handler.
    const store = createRootStore();
    const { getAllByRole } = renderPanel(store);
    fireEvent.keyDown(getAllByRole("option")[1], { key: "Enter" });
    expect(store.ui.selectedTrialLetter).toBe("A"); // unchanged by the handler
    fireEvent.click(getAllByRole("option")[1]); // native activation selects exactly once
    expect(store.ui.selectedTrialLetter).toBe("B");
  });
});
