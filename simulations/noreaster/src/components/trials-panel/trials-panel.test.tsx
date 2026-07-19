import { Announcer, MAX_TRIALS_DEFAULT } from "@concord-consortium/mass-sims-shared";
import { act, fireEvent, render, within } from "@testing-library/react";
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

import {
  createRootStore,
  type RootStoreInstance,
  RootStoreProvider,
} from "../../stores/root-store";
import { TrialsPanel } from "./trials-panel";

// Any single selection gives a trial "progress" (`canReset`), which enables its reset affordance.
function giveProgress(store: RootStoreInstance) {
  store.activeTrial.setLandHumidity("Dry");
}

function renderPanel(store: RootStoreInstance) {
  // Under the shared <Announcer> so reset / max-trials narration can be asserted.
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

describe("TrialsPanel — listbox structure", () => {
  it("renders a vertical listbox labeled Trials (single-select, no aria-multiselectable)", () => {
    const { getByRole } = renderPanel(storeWith(1));
    const listbox = getByRole("listbox", { name: "Trials" });
    expect(listbox).toHaveAttribute("aria-orientation", "vertical");
    expect(listbox).not.toHaveAttribute("aria-multiselectable");
  });

  it("renders one role=option per trial, with aria-selected tracking selection", () => {
    const { getAllByRole } = renderPanel(storeWith(3));
    const options = getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");
  });

  it("the listbox owns ONLY option cards — the + New card and reset are outside it", () => {
    const store = storeWith(3);
    giveProgress(store); // enable the reset so it renders as a button
    const { getByRole } = renderPanel(store);
    const listbox = getByRole("listbox", { name: "Trials" });
    expect(within(listbox).getAllByRole("option")).toHaveLength(3);
    expect(listbox.contains(getByRole("button", { name: "Reset trial A" }))).toBe(false);
    expect(listbox.contains(getByRole("button", { name: "Add new trial" }))).toBe(false);
    // Every direct child is a presentational (role="none") TrialCard wrapper, so the option button
    // inside each reads as a direct child of the listbox — no unannotated <div> in the owned chain.
    for (const child of Array.from(listbox.children)) {
      expect(child).toHaveAttribute("role", "none");
    }
  });

  it("applies roving tabindex: only the selected option is tabbable", () => {
    const { getAllByRole } = renderPanel(storeWith(3));
    const options = getAllByRole("option");
    expect(options[0]).toHaveAttribute("tabindex", "0");
    expect(options[1]).toHaveAttribute("tabindex", "-1");
    expect(options[2]).toHaveAttribute("tabindex", "-1");
  });

  it("shows the Add new trial card below the cap", () => {
    const { getByRole } = renderPanel(storeWith(1));
    expect(getByRole("button", { name: "Add new trial" })).toBeInTheDocument();
  });

  it("adding a trial via the New card selects it", () => {
    const store = storeWith(1);
    const { getByRole, getAllByRole } = renderPanel(store);
    fireEvent.click(getByRole("button", { name: "Add new trial" }));
    const options = getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(store.ui.selectedTrialLetter).toBe("B");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  it("replaces the New card with a plain-text notice at the cap (no role=status)", () => {
    const { container, queryByRole } = renderPanel(storeWith(10));
    expect(queryByRole("button", { name: "Add new trial" })).toBeNull();
    // The notice is plain visible text, not a role="status" live region.
    expect(container.querySelector(".max-trials-notice")).toHaveTextContent(
      /max number of trials/i,
    );
    expect(queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("TrialsPanel — narration", () => {
  it("announces the max-trials cap through the announcer when the last trial is added", () => {
    // Start one below the cap so clicking + New creates the 10th trial and hits the cap.
    const { getByRole, region } = renderPanel(storeWith(9));
    fireEvent.click(getByRole("button", { name: "Add new trial" }));
    expect(region).toHaveTextContent(`Maximum of ${MAX_TRIALS_DEFAULT} trials reached.`);
  });

  it("announces 'Trial A reset.' when the panel reset is pressed", () => {
    // Give A progress so its (selected-trial) reset is enabled.
    const store = storeWith(1);
    act(() => giveProgress(store));
    const { getByRole, region } = renderPanel(store);
    fireEvent.click(getByRole("button", { name: "Reset trial A" }));
    expect(region).toHaveTextContent("Trial A reset.");
  });
});

describe("TrialsPanel — card labelling", () => {
  it("labels a card with just its trial letter (no per-trial data yet)", () => {
    const { getByRole } = renderPanel(storeWith(1));
    expect(getByRole("option", { name: /^Trial A/ }).getAttribute("aria-label")).toBe("Trial A");
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
    fireEvent.click(getAllByRole("option")[1]);
    expect(logEvent).toHaveBeenCalledWith("trial_selected", { trial: "B", previous: "A" });
  });

  it("emits nothing when the already-selected card is clicked (no-op skip)", () => {
    const { getAllByRole } = renderPanel(storeWith(2));
    logEvent.mockReset();
    fireEvent.click(getAllByRole("option")[0]); // A is selected by default
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("logs trial_selected on keyboard navigation", () => {
    const { getAllByRole } = renderPanel(storeWith(3));
    logEvent.mockReset();
    fireEvent.keyDown(getAllByRole("option")[0], { key: "ArrowDown" });
    expect(logEvent).toHaveBeenCalledWith("trial_selected", { trial: "B", previous: "A" });
  });

  it("emits nothing when keyboard nav moves onto the non-selectable + New card", () => {
    // ArrowDown from the only trial lands on the + New card (the ring's last node); it isn't
    // selectable, so no selection change occurs and nothing is logged.
    const { getAllByRole } = renderPanel(storeWith(1));
    logEvent.mockReset();
    fireEvent.keyDown(getAllByRole("option")[0], { key: "ArrowDown" }); // A → + New (focus only)
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("logs trial_reset for the selected trial via the panel reset button", () => {
    const store = storeWith(1);
    giveProgress(store); // give A progress so reset is enabled
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
    fireEvent.click(getAllByRole("option")[1]);
    expect(scrollSpy).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
    scrollSpy.mockRestore();
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });
});

describe("TrialsPanel — keyboard-nav wiring", () => {
  // The ring itself (ArrowDown/Up/Home/End across the cards AND the + New card, wrapping, the cap,
  // focus-after-add) is BEHAVIOR owned by the shared hook and tested once, sim-agnostically, in
  // packages/shared/src/hooks/use-trials-keyboard-nav.test.tsx. Don't re-test it here.
  //
  // These tests prove only that THIS panel wires the hook up: the handlers reach both the listbox
  // and the + New card, the hook's tabIndexes land on the cards / + New / reset, and handleAdd calls
  // focusAddedTrial. That includes pinning the `.trial-card` / `.new-trial-card` / `.reset-button`
  // class convention the hook selects on — the one thing the hook's own harness can't catch.
  it("ArrowDown on a card selects the next one (handler wired to the listbox)", () => {
    const store = storeWith(3);
    const { getAllByRole } = renderPanel(store);
    fireEvent.keyDown(getAllByRole("option")[0], { key: "ArrowDown" });
    expect(store.ui.selectedTrialLetter).toBe("B");
  });

  it("End reaches the + New card (handlers wired to the card outside the listbox)", () => {
    const store = storeWith(3);
    store.ui.selectTrial("B");
    const { getAllByRole, getByRole } = renderPanel(store);
    const newCard = getByRole("button", { name: "Add new trial" });
    fireEvent.keyDown(getAllByRole("option")[1], { key: "End" });
    expect(newCard).toBe(document.activeElement);
    expect(store.ui.selectedTrialLetter).toBe("B"); // + New isn't selectable

    // ...and the + New card's own handler drives the ring back into the listbox.
    fireEvent.keyDown(newCard, { key: "Home" });
    expect(store.ui.selectedTrialLetter).toBe("A");
  });

  it("moving to the + New card shifts the single tab stop off the cards and the reset", () => {
    const store = storeWith(3);
    giveProgress(store); // reset enabled so it renders as a button
    const { getAllByRole, getByRole } = renderPanel(store);
    fireEvent.keyDown(getAllByRole("option")[0], { key: "End" }); // → + New
    expect(getByRole("button", { name: "Add new trial" })).toHaveAttribute("tabindex", "0");
    for (const option of getAllByRole("option")) expect(option).toHaveAttribute("tabindex", "-1");
    expect(getByRole("button", { name: "Reset trial A" })).toHaveAttribute("tabindex", "-1");
  });

  it("moves focus onto the newly added card when + New is activated (focusAddedTrial wired)", () => {
    const store = storeWith(2);
    store.ui.selectTrial("B");
    const { getByRole, getAllByRole } = renderPanel(store);
    fireEvent.click(getByRole("button", { name: "Add new trial" }));
    expect(store.ui.selectedTrialLetter).toBe("C");
    const options = getAllByRole("option");
    expect(options[options.length - 1]).toBe(document.activeElement); // focus follows the add
  });

  it("ignores Enter in the listbox handler (native button activation selects — no double)", () => {
    // The listbox onKeyDown handles only arrows/Home/End; Enter/Space are the option button's
    // native job, so a keydown Enter on an unselected option does NOT select via the handler.
    const store = storeWith(3);
    const { getAllByRole } = renderPanel(store);
    fireEvent.keyDown(getAllByRole("option")[1], { key: "Enter" });
    expect(store.ui.selectedTrialLetter).toBe("A"); // unchanged by the handler
    fireEvent.click(getAllByRole("option")[1]); // native activation selects exactly once
    expect(store.ui.selectedTrialLetter).toBe("B");
  });
});
