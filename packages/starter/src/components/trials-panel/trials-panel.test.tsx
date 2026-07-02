import { Announcer, MAX_TRIALS_DEFAULT } from "@concord-consortium/mass-sims-shared";
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
  // Under the shared <Announcer> so reset / max-trials narration can be asserted (F-4).
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RootStoreProvider store={store}>
      <Announcer>{children}</Announcer>
    </RootStoreProvider>
  );
  const utils = render(<TrialsPanel />, { wrapper });
  const region = utils.container.querySelector('[aria-live="polite"]') as HTMLElement;
  return { region, ...utils };
}

/** A store seeded with `count` trials (A, B, …), with A selected. */
function storeWith(count: number): RootStoreInstance {
  const store = createRootStore();
  for (let i = 1; i < count; i++) store.addTrial();
  store.ui.selectTrial("A");
  return store;
}

describe("TrialsPanel — tab-like structure", () => {
  it("renders a vertical tablist labeled Trials", () => {
    const { getByRole } = renderPanel(storeWith(1));
    const tablist = getByRole("tablist", { name: "Trials" });
    expect(tablist).toHaveAttribute("aria-orientation", "vertical");
  });

  it("renders one role=tab per trial, with aria-selected tracking selection", () => {
    const { getAllByRole } = renderPanel(storeWith(3));
    const tabs = getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
  });

  it("applies roving tabindex: only the selected tab is tabbable", () => {
    const { getAllByRole } = renderPanel(storeWith(3));
    const tabs = getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
    expect(tabs[2]).toHaveAttribute("tabindex", "-1");
  });

  it("shows the Add new trial card below the cap", () => {
    const { getByRole } = renderPanel(storeWith(1));
    expect(getByRole("button", { name: "Add new trial" })).toBeInTheDocument();
  });

  it("adding a trial via the New card selects it", () => {
    const store = storeWith(1);
    const { getByRole, getAllByRole } = renderPanel(store);
    fireEvent.click(getByRole("button", { name: "Add new trial" }));
    const tabs = getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(store.ui.selectedTrialLetter).toBe("B");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
  });

  it("replaces the New card with a plain-text notice at the cap (no role=status)", () => {
    const { container, queryByRole } = renderPanel(storeWith(10));
    expect(queryByRole("button", { name: "Add new trial" })).toBeNull();
    // The notice is plain visible text now (F-4), not a role="status" live region.
    expect(container.querySelector(".max-trials-notice")).toHaveTextContent(
      /max number of trials/i,
    );
    expect(queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("TrialsPanel — narration (F-4)", () => {
  it("announces the max-trials cap through the announcer when the last trial is added", () => {
    // Start one below the cap so clicking + New creates the 10th trial and hits the cap.
    const { getByRole, region } = renderPanel(storeWith(9));
    fireEvent.click(getByRole("button", { name: "Add new trial" }));
    expect(region).toHaveTextContent(`Maximum of ${MAX_TRIALS_DEFAULT} trials reached.`);
  });

  it("announces 'Trial A reset.' when a card's reset is pressed", () => {
    // Seed A with output so its (selected-card) reset is enabled.
    const store = storeWith(1);
    act(() => store.activeTrial.setOutput(OUTPUT, TRANSIENT));
    const { getByRole, region } = renderPanel(store);
    fireEvent.click(getByRole("button", { name: "Reset trial A" }));
    expect(region).toHaveTextContent("Trial A reset.");
  });
});

describe("TrialsPanel — enriched aria-label", () => {
  it("labels an unrun card with the trial letter and its parameters", () => {
    const { getByRole } = renderPanel(storeWith(1));
    expect(getByRole("tab", { name: /^Trial A/ }).getAttribute("aria-label")).toBe(
      "Trial A. Walker count 50, step size 1",
    );
  });

  it("appends the recorded avg + standard deviation once the trial has run, reactively", () => {
    const store = storeWith(1);
    const { getByRole } = renderPanel(store);
    act(() => store.activeTrial.setOutput(OUTPUT, TRANSIENT));
    expect(getByRole("tab", { name: /^Trial A/ }).getAttribute("aria-label")).toBe(
      "Trial A. Walker count 50, step size 1. Average distance 12.3, standard deviation 2.1",
    );
  });
});

describe("TrialsPanel — trial-list logging", () => {
  it("logs trial_added then trial_selected (in that order) when + New is clicked", () => {
    const { getByRole } = renderPanel(storeWith(1));
    logEvent.mockReset();
    fireEvent.click(getByRole("button", { name: "Add new trial" }));
    expect(logEvent).toHaveBeenNthCalledWith(1, "trial_added", { trial: "B" });
    expect(logEvent).toHaveBeenNthCalledWith(2, "trial_selected", { trial: "B", previous: "A" });
  });

  it("logs trial_selected with the previous letter on card click", () => {
    const { getAllByRole } = renderPanel(storeWith(2));
    logEvent.mockReset();
    fireEvent.click(getAllByRole("tab")[1]);
    expect(logEvent).toHaveBeenCalledWith("trial_selected", { trial: "B", previous: "A" });
  });

  it("emits nothing when the already-selected card is clicked (no-op skip)", () => {
    const { getAllByRole } = renderPanel(storeWith(2));
    logEvent.mockReset();
    fireEvent.click(getAllByRole("tab")[0]); // A is selected by default
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("logs trial_selected on keyboard navigation", () => {
    const { getAllByRole } = renderPanel(storeWith(3));
    logEvent.mockReset();
    fireEvent.keyDown(getAllByRole("tab")[0], { key: "ArrowDown" });
    expect(logEvent).toHaveBeenCalledWith("trial_selected", { trial: "B", previous: "A" });
  });

  it("emits nothing when keyboard nav is a no-op at the boundary", () => {
    const { getAllByRole } = renderPanel(storeWith(2));
    logEvent.mockReset();
    fireEvent.keyDown(getAllByRole("tab")[0], { key: "ArrowUp" }); // already at the top
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("logs trial_reset with the iteration letter on the per-card reset overhang", () => {
    const store = storeWith(1);
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
    const { getAllByRole } = renderPanel(storeWith(2));
    scrollSpy.mockClear();
    fireEvent.click(getAllByRole("tab")[1]);
    expect(scrollSpy).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
    scrollSpy.mockRestore();
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });
});

describe("TrialsPanel — roving-tabindex keyboard navigation", () => {
  it("ArrowDown moves focus AND selection to the next card (no wrap at the end)", () => {
    const store = storeWith(3);
    const { getAllByRole } = renderPanel(store);
    const tabs = getAllByRole("tab");
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: "ArrowDown" });
    expect(store.ui.selectedTrialLetter).toBe("B");

    // From the last card, ArrowDown does not wrap.
    act(() => store.ui.selectTrial("C"));
    fireEvent.keyDown(getAllByRole("tab")[2], { key: "ArrowDown" });
    expect(store.ui.selectedTrialLetter).toBe("C");
  });

  it("ArrowUp moves to the previous card (no wrap at the start)", () => {
    const store = storeWith(3);
    store.ui.selectTrial("B");
    const { getAllByRole } = renderPanel(store);
    fireEvent.keyDown(getAllByRole("tab")[1], { key: "ArrowUp" });
    expect(store.ui.selectedTrialLetter).toBe("A");

    fireEvent.keyDown(getAllByRole("tab")[0], { key: "ArrowUp" });
    expect(store.ui.selectedTrialLetter).toBe("A");
  });

  it("Home and End jump to the first and last cards", () => {
    const store = storeWith(3);
    store.ui.selectTrial("B");
    const { getAllByRole } = renderPanel(store);
    fireEvent.keyDown(getAllByRole("tab")[1], { key: "End" });
    expect(store.ui.selectedTrialLetter).toBe("C");
    fireEvent.keyDown(getAllByRole("tab")[2], { key: "Home" });
    expect(store.ui.selectedTrialLetter).toBe("A");
  });

  it("ignores Left/Right (vertical orientation per WAI-ARIA)", () => {
    const store = storeWith(3);
    const { getAllByRole } = renderPanel(store);
    fireEvent.keyDown(getAllByRole("tab")[0], { key: "ArrowRight" });
    expect(store.ui.selectedTrialLetter).toBe("A");
    fireEvent.keyDown(getAllByRole("tab")[0], { key: "ArrowLeft" });
    expect(store.ui.selectedTrialLetter).toBe("A");
  });
});
