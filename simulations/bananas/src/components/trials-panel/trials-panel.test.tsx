import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// TrialsPanel consumes useLogEvent directly, so mock the hook (the seam it uses) while preserving
// the real shared exports it also imports (TrialCard). vi.hoisted so the spy exists when vi.mock runs.
const { logEvent } = vi.hoisted(() => ({ logEvent: vi.fn() }));
vi.mock("@concord-consortium/mass-sims-shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@concord-consortium/mass-sims-shared")>()),
  useLogEvent: () => logEvent,
}));

import { Announcer, MAX_TRIALS_DEFAULT } from "@concord-consortium/mass-sims-shared";
import type { OffspringPlant } from "../../model/genetics";
import { type RootStoreInstance, RootStoreProvider } from "../../stores/root-store";
import { createTestStore } from "../../stores/test-helpers";
import { TrialsPanel } from "./trials-panel";

function plant(infected: boolean): OffspringPlant {
  return { genotype: infected ? "rr" : "Rr", isResistant: !infected, infected };
}

function renderPanel(store: RootStoreInstance = createTestStore()) {
  const utils = render(
    <RootStoreProvider store={store}>
      {/* Under the shared <Announcer> so reset / max-trials narration can be asserted. */}
      <Announcer>
        <TrialsPanel />
      </Announcer>
    </RootStoreProvider>,
  );
  const region = utils.container.querySelector('[aria-live="polite"]') as HTMLElement;
  return { store, region, ...utils };
}

const tenTrials = () =>
  createTestStore({
    trials: { A: {}, B: {}, C: {}, D: {}, E: {}, F: {}, G: {}, H: {}, I: {}, J: {} },
  });

const threeTrials = () => createTestStore({ trials: { A: {}, B: {}, C: {} } });

describe("TrialsPanel — structure", () => {
  it("renders the tablist with one card and a + New card initially, no max notice", () => {
    const { container, getByRole, queryByRole } = renderPanel();
    expect(getByRole("tablist", { name: "Trials" })).toBeInTheDocument();
    expect(getByRole("tab", { name: /^Trial A/ })).toBeInTheDocument();
    expect(getByRole("button", { name: "Add new trial" })).toBeInTheDocument();
    expect(queryByRole("status")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".trial-card")).toHaveLength(1);
  });
});

describe("TrialsPanel — add / select", () => {
  it("clicking + New appends the next trial and selects it", () => {
    const { store, getByRole } = renderPanel();
    fireEvent.click(getByRole("button", { name: "Add new trial" }));
    expect(store.trialLetters).toEqual(["A", "B"]);
    expect(store.ui.selectedTrialLetter).toBe("B");
  });

  it("clicking a card selects that trial without clearing other trials' cross memory", () => {
    const store = createTestStore({
      trials: { A: { crosses: [[plant(false)]] }, B: {} },
      ui: { selectedCrossByTrial: { A: 0 } },
    });
    const { getByRole } = renderPanel(store);
    fireEvent.click(getByRole("tab", { name: /^Trial B/ }));
    expect(store.ui.selectedTrialLetter).toBe("B");
    // A's cross-selection memory survives the switch (Resolved decision #1).
    expect(store.ui.selectedCrossByTrial.get("A")).toBe(0);
  });
});

describe("TrialsPanel — logging", () => {
  it("logs trial_added then trial_selected (in that order) when + New is clicked", () => {
    const { getByRole } = renderPanel();
    logEvent.mockReset();
    fireEvent.click(getByRole("button", { name: "Add new trial" }));
    expect(logEvent).toHaveBeenNthCalledWith(1, "trial_added", { trial: "B" });
    expect(logEvent).toHaveBeenNthCalledWith(2, "trial_selected", { trial: "B", previous: "A" });
  });

  it("logs trial_selected with the previous letter on card click", () => {
    const { getByRole } = renderPanel(createTestStore({ trials: { A: {}, B: {} } }));
    logEvent.mockReset();
    fireEvent.click(getByRole("tab", { name: /^Trial B/ }));
    expect(logEvent).toHaveBeenCalledWith("trial_selected", { trial: "B", previous: "A" });
  });

  it("emits nothing when the already-selected card is clicked (no-op skip)", () => {
    const { getByRole } = renderPanel(createTestStore({ trials: { A: {}, B: {} } }));
    logEvent.mockReset();
    fireEvent.click(getByRole("tab", { name: /^Trial A/ })); // A is selected by default
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("logs trial_selected on keyboard navigation", () => {
    const { container } = renderPanel(createTestStore({ trials: { A: {}, B: {}, C: {} } }));
    const cards = container.querySelectorAll(".trial-card");
    logEvent.mockReset();
    fireEvent.keyDown(cards[0], { key: "ArrowDown" });
    expect(logEvent).toHaveBeenCalledWith("trial_selected", { trial: "B", previous: "A" });
  });

  it("emits nothing when keyboard nav is a no-op at the boundary", () => {
    const { container } = renderPanel(createTestStore({ trials: { A: {}, B: {} } }));
    const cards = container.querySelectorAll(".trial-card");
    logEvent.mockReset();
    fireEvent.keyDown(cards[0], { key: "ArrowUp" }); // already at the top → target stays A
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("logs trial_reset with the iteration letter on the per-card reset overhang", () => {
    const store = createTestStore({ trials: { A: { p1: "wild-w1", crosses: [[plant(false)]] } } });
    const { getByRole } = renderPanel(store); // A selected by default → its reset is visible
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
    const { getByRole } = renderPanel(createTestStore({ trials: { A: {}, B: {} } }));
    scrollSpy.mockClear();
    fireEvent.click(getByRole("tab", { name: /^Trial B/ }));
    expect(scrollSpy).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
    scrollSpy.mockRestore();
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });
});

describe("TrialsPanel — max trials", () => {
  it("hides + New and shows the plain-text notice at the 10-trial cap", () => {
    const { container, queryByRole } = renderPanel(tenTrials());
    expect(queryByRole("button", { name: "Add new trial" })).not.toBeInTheDocument();
    expect(container.querySelector(".max-trials-notice")).toHaveTextContent(
      "Max number of trials reached",
    );
  });

  it("announces the max-trials cap through the announcer when the last trial is added", () => {
    // Start one below the cap (A–I) so clicking + New creates the 10th trial (J) and hits the cap.
    const nineTrials = createTestStore({
      trials: { A: {}, B: {}, C: {}, D: {}, E: {}, F: {}, G: {}, H: {}, I: {} },
    });
    const { getByRole, region } = renderPanel(nineTrials);
    fireEvent.click(getByRole("button", { name: "Add new trial" }));
    expect(region).toHaveTextContent(`Maximum of ${MAX_TRIALS_DEFAULT} trials reached.`);
  });
});

describe("TrialsPanel — per-card reset", () => {
  it("resets only the targeted trial when its reset button is clicked", () => {
    const store = createTestStore({
      trials: { A: { p1: "wild-w1", crosses: [[plant(false)]] }, B: { p1: "cavendish-c1" } },
    });
    // A is selected by default → its reset button is the visible one.
    const { getByRole, region } = renderPanel(store);
    fireEvent.click(getByRole("button", { name: "Reset trial A" }));
    expect(store.trials.get("A")?.canReset).toBe(false);
    expect(store.trials.get("B")?.p1).toBe("cavendish-c1"); // untouched
    // The reset narrates through the shared announcer.
    expect(region).toHaveTextContent("Trial A reset.");
  });
});

describe("TrialsPanel — roving tabindex", () => {
  it("gives only the selected card tabIndex 0; the rest -1", () => {
    const store = threeTrials();
    store.ui.selectTrial("B");
    const { container } = renderPanel(store);
    const cards = container.querySelectorAll(".trial-card");
    expect(cards[0]).toHaveAttribute("tabindex", "-1"); // A
    expect(cards[1]).toHaveAttribute("tabindex", "0"); // B (selected)
    expect(cards[2]).toHaveAttribute("tabindex", "-1"); // C
  });
});

describe("TrialsPanel — aria-label enrichment + reactivity", () => {
  it("enriches the card aria-label with parents and offspring counts", () => {
    const store = createTestStore({
      trials: {
        A: {
          p1: "wild-w1",
          p2: "cavendish-c1",
          locked: true,
          crosses: [[plant(false), plant(false), plant(true)]],
        },
      },
    });
    const { getByRole } = renderPanel(store);
    expect(getByRole("tab", { name: /^Trial A/ }).getAttribute("aria-label")).toBe(
      "Trial A. W1 crossed with C1. 3 offspring, 2 healthy, 1 infected",
    );
  });

  it("updates the aria-label reactively when the trial is crossed", () => {
    const store = createTestStore({ trials: { A: { p1: "wild-w1", p2: "cavendish-c1" } } });
    const { getByRole } = renderPanel(store);
    expect(getByRole("tab", { name: /^Trial A/ }).getAttribute("aria-label")).toBe(
      "Trial A. W1 crossed with C1",
    );
    act(() => {
      store.trials.get("A")?.crossPlants();
    });
    expect(getByRole("tab", { name: /^Trial A/ }).getAttribute("aria-label")).toMatch(
      /^Trial A\. W1 crossed with C1\. \d+ offspring, \d+ healthy, \d+ infected$/,
    );
  });
});

describe("TrialsPanel — keyboard navigation", () => {
  it("ArrowDown moves selection to the next card (no wrap at the end)", () => {
    const { store, container } = renderPanel(threeTrials());
    const cards = container.querySelectorAll(".trial-card");
    fireEvent.keyDown(cards[0], { key: "ArrowDown" });
    expect(store.ui.selectedTrialLetter).toBe("B");
    act(() => store.ui.selectTrial("C"));
    fireEvent.keyDown(cards[2], { key: "ArrowDown" });
    expect(store.ui.selectedTrialLetter).toBe("C"); // no wrap past the last card
  });

  it("ArrowUp moves to the previous card (no wrap at the top)", () => {
    const store = threeTrials();
    store.ui.selectTrial("B");
    const { container } = renderPanel(store);
    const cards = container.querySelectorAll(".trial-card");
    fireEvent.keyDown(cards[1], { key: "ArrowUp" });
    expect(store.ui.selectedTrialLetter).toBe("A");
    fireEvent.keyDown(cards[0], { key: "ArrowUp" });
    expect(store.ui.selectedTrialLetter).toBe("A"); // no wrap past the first card
  });

  it("Home / End jump to the first / last card", () => {
    const store = threeTrials();
    store.ui.selectTrial("B");
    const { container } = renderPanel(store);
    const cards = container.querySelectorAll(".trial-card");
    fireEvent.keyDown(cards[1], { key: "End" });
    expect(store.ui.selectedTrialLetter).toBe("C");
    fireEvent.keyDown(cards[2], { key: "Home" });
    expect(store.ui.selectedTrialLetter).toBe("A");
  });

  it("ignores arrow keys when focus is not on a trial card (e.g. the + New card)", () => {
    const { store, getByRole } = renderPanel(threeTrials());
    fireEvent.keyDown(getByRole("button", { name: "Add new trial" }), { key: "ArrowDown" });
    expect(store.ui.selectedTrialLetter).toBe("A"); // unchanged
  });
});

describe("TrialsPanel — accessibility audit (Task 5)", () => {
  it("exposes a vertical tablist named Trials", () => {
    const { getByRole } = renderPanel();
    expect(getByRole("tablist", { name: /trials/i })).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
  });

  it("renders each card as a tab with aria-selected reflecting selection", () => {
    const store = createTestStore({ trials: { A: {}, B: {} } });
    store.ui.selectTrial("B");
    const { getAllByRole } = renderPanel(store);
    const tabs = getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute("aria-selected", "false"); // A
    expect(tabs[1]).toHaveAttribute("aria-selected", "true"); // B (selected)
  });

  it("renders the max-trials notice", () => {
    const { container, queryByRole } = renderPanel(tenTrials());
    expect(container.querySelector(".max-trials-notice")).toHaveTextContent(
      "Max number of trials reached",
    );
    // No ambient status region: all narration goes through the single shared announcer instead.
    expect(queryByRole("status")).not.toBeInTheDocument();
  });

  it("reflects reset availability via aria-disabled on the selected card's reset button", () => {
    // Selected empty trial A → reset present but disabled.
    const empty = renderPanel();
    expect(empty.getByRole("button", { name: "Reset trial A" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    empty.unmount();
    // Selected trial A with progress → reset enabled (the shared button omits aria-disabled rather
    // than emitting "false"; absent === not-disabled to assistive tech).
    const withProgress = renderPanel(createTestStore({ trial: { p1: "wild-w1" } }));
    expect(withProgress.getByRole("button", { name: "Reset trial A" })).not.toHaveAttribute(
      "aria-disabled",
    );
  });
});
