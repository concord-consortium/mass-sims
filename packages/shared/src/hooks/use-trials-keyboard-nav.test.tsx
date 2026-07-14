import { fireEvent, render } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useTrialsKeyboardNav } from "./use-trials-keyboard-nav";

/**
 * A minimal stand-in for a sim's TrialsPanel: a `role="listbox"` of `.trial-card` option buttons, a
 * `.reset-button`, and (below the cap) a `.new-trial-card` button — the exact DOM shape the hook
 * queries and drives. Selection-follows-focus and the cap are modelled with local state so the hook
 * can be exercised without any store. `onSelect` is a spy seam for asserting selection changes.
 *
 * This suite owns the hook's BEHAVIOR (the arrow ring, the roving tab stop, focus-after-add) once,
 * sim-agnostically. The sims' own TrialsPanel tests deliberately don't re-test it — they only prove
 * each panel WIRES the hook up (handlers + tabIndexes on the right elements). One caveat this
 * harness can't cover, and why those wiring tests still exist: the hook finds its elements by the
 * `.trial-card` / `.new-trial-card` / `.reset-button` class convention, which the harness hard-codes
 * — so only a real-panel test can catch a panel that renames them.
 */
function Harness({
  start = ["A", "B", "C"],
  selectedStart = "A",
  maxTrials = 10,
  onSelect,
}: {
  start?: string[];
  selectedStart?: string;
  maxTrials?: number;
  onSelect?: (letter: string) => void;
}) {
  const [letters, setLetters] = useState<string[]>(start);
  const [selected, setSelected] = useState(selectedStart);
  const containerRef = useRef<HTMLDivElement>(null);
  const canAddTrial = letters.length < maxTrials;
  const selectedIndex = Math.max(0, letters.indexOf(selected));
  const selectLetter = (letter: string) => {
    onSelect?.(letter);
    setSelected(letter);
  };
  const nav = useTrialsKeyboardNav({
    containerRef,
    letters,
    selectedIndex,
    canAddTrial,
    selectLetter,
  });

  const add = () => {
    const next = String.fromCharCode(65 + letters.length);
    setLetters((ls) => [...ls, next]);
    setSelected(next);
    nav.focusAddedTrial();
  };

  // Handlers ride the listbox (delegates for the cards) and the `+ New` card, mirroring the real
  // panels — the outer wrapper stays a plain, non-interactive container.
  return (
    <div ref={containerRef}>
      <div role="listbox" aria-label="Trials" onKeyDown={nav.onKeyDown} onFocus={nav.onFocus}>
        {letters.map((letter) => (
          // The presentational wrapper mirrors the real <TrialCard>: it is what carries scroll-margin
          // and what the hook scrolls, so the harness must reproduce it.
          <div key={letter} className="trial-card-wrapper" role="none">
            <button
              type="button"
              className="trial-card"
              role="option"
              aria-label={`Trial ${letter}`}
              aria-selected={letter === selected}
              tabIndex={letter === selected ? nav.selectedCardTabIndex : -1}
            >
              {letter}
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="reset-button"
        aria-label="Reset"
        tabIndex={nav.resetTabIndex}
      >
        reset
      </button>
      {canAddTrial && (
        <button
          type="button"
          className="new-trial-card"
          aria-label="Add new trial"
          tabIndex={nav.newCardTabIndex}
          onClick={add}
          onKeyDown={nav.onKeyDown}
          onFocus={nav.onFocus}
        >
          New
        </button>
      )}
    </div>
  );
}

/** The accessible name of the currently focused element (jsdom has no `toBeFocused` matcher). */
function focusedLabel() {
  return document.activeElement?.getAttribute("aria-label") ?? null;
}

function setup(props: Parameters<typeof Harness>[0] = {}) {
  const utils = render(<Harness {...props} />);
  const card = (letter: string) => utils.getByRole("option", { name: `Trial ${letter}` });
  const newCard = () => utils.queryByRole("button", { name: "Add new trial" });
  const reset = () => utils.getByRole("button", { name: "Reset" });
  return { ...utils, card, newCard, reset };
}

describe("useTrialsKeyboardNav — roving tab stop", () => {
  it("initially: selected card tabbable, others -1, + New and reset reflect the options tab stop", () => {
    const { card, newCard, reset } = setup();
    expect(card("A")).toHaveAttribute("tabindex", "0"); // selected
    expect(card("B")).toHaveAttribute("tabindex", "-1");
    expect(card("C")).toHaveAttribute("tabindex", "-1");
    expect(newCard()).toHaveAttribute("tabindex", "-1"); // reachable only via arrows
    expect(reset()).toHaveAttribute("tabindex", "0"); // shares the options tab stop
  });

  it("moving to the + New card makes IT the only tab stop (cards and reset drop to -1)", () => {
    const { card, newCard, reset } = setup();
    fireEvent.keyDown(card("C"), { key: "End" }); // End → + New card
    expect(focusedLabel()).toBe("Add new trial");
    expect(newCard()).toHaveAttribute("tabindex", "0");
    expect(card("A")).toHaveAttribute("tabindex", "-1");
    expect(reset()).toHaveAttribute("tabindex", "-1");
  });
});

describe("useTrialsKeyboardNav — arrow ring (cards + New card)", () => {
  it("ArrowDown from the last card lands on the + New card, without changing selection", () => {
    const onSelect = vi.fn();
    const { card } = setup({ selectedStart: "C", onSelect });
    fireEvent.keyDown(card("C"), { key: "ArrowDown" });
    expect(focusedLabel()).toBe("Add new trial");
    expect(onSelect).not.toHaveBeenCalled(); // + New isn't selectable
  });

  it("ArrowUp from the first card lands on the + New card", () => {
    const { card } = setup({ selectedStart: "A" });
    fireEvent.keyDown(card("A"), { key: "ArrowUp" });
    expect(focusedLabel()).toBe("Add new trial");
  });

  it("ArrowDown from the + New card wraps to the first card and selects it", () => {
    const onSelect = vi.fn();
    const { card, newCard } = setup({ selectedStart: "C", onSelect });
    fireEvent.keyDown(card("C"), { key: "ArrowDown" }); // → + New
    fireEvent.keyDown(newCard() as HTMLElement, { key: "ArrowDown" }); // wraps → A
    expect(focusedLabel()).toBe("Trial A");
    expect(onSelect).toHaveBeenLastCalledWith("A");
  });

  it("ArrowUp from the + New card lands on the last card", () => {
    const onSelect = vi.fn();
    const { card, newCard } = setup({ selectedStart: "A", onSelect });
    fireEvent.keyDown(card("A"), { key: "ArrowUp" }); // → + New
    fireEvent.keyDown(newCard() as HTMLElement, { key: "ArrowUp" }); // → last card C
    expect(focusedLabel()).toBe("Trial C");
    expect(onSelect).toHaveBeenLastCalledWith("C");
  });

  it("Home jumps to the first card; End jumps to the + New card", () => {
    const { card, newCard } = setup({ selectedStart: "B" });
    fireEvent.keyDown(card("B"), { key: "End" });
    expect(focusedLabel()).toBe("Add new trial");
    fireEvent.keyDown(newCard() as HTMLElement, { key: "Home" });
    expect(focusedLabel()).toBe("Trial A");
  });
});

describe("useTrialsKeyboardNav — at the trials cap (no + New card)", () => {
  it("the ring is the cards alone: End → last card, ArrowDown from last wraps to first", () => {
    const { card, newCard } = setup({ start: ["A", "B", "C"], maxTrials: 3, selectedStart: "A" });
    expect(newCard()).toBeNull(); // capped: no + New card
    fireEvent.keyDown(card("A"), { key: "End" });
    expect(focusedLabel()).toBe("Trial C");
    fireEvent.keyDown(card("C"), { key: "ArrowDown" }); // wraps last → first
    expect(focusedLabel()).toBe("Trial A");
  });
});

describe("useTrialsKeyboardNav — ignored keys", () => {
  it("does not act on Left/Right/Enter (vertical orientation; native activation owns Enter)", () => {
    const onSelect = vi.fn();
    const { card } = setup({ onSelect });
    for (const key of ["ArrowLeft", "ArrowRight", "Enter", " "]) {
      const notPrevented = fireEvent.keyDown(card("A"), { key });
      expect(notPrevented).toBe(true); // event not canceled → hook ignored it
    }
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("useTrialsKeyboardNav — scrolling back from the + New card", () => {
  /** Spy on scrollIntoView, capturing the ELEMENT it was called on (jsdom doesn't implement it). */
  function spyOnScroll() {
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = () => {};
    const targets: Element[] = [];
    const spy = vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(function (
      this: HTMLElement,
    ) {
      targets.push(this);
    });
    return {
      targets,
      restore: () => {
        spy.mockRestore();
        HTMLElement.prototype.scrollIntoView = original;
      },
    };
  }

  // Landing on + New scrolls the list to the bottom. Arrowing back onto the card that is STILL
  // selected is a no-op for selectLetter, so useScrollSelectedTrialIntoView (which keys off the
  // selected letter changing) never fires — without an explicit scroll here, focus would sit on an
  // off-screen card.
  it("scrolls the card back into view when arrowing off + New onto the still-selected card", () => {
    const { targets, restore } = spyOnScroll();
    const { card, newCard } = setup({ selectedStart: "A" }); // A is the FIRST card
    fireEvent.keyDown(card("A"), { key: "ArrowUp" }); // first card → + New (scrolls to bottom)
    targets.length = 0;
    fireEvent.keyDown(newCard() as HTMLElement, { key: "ArrowDown" }); // wraps back onto A (no-op select)

    // The wrapper — not the inner option button — is the scroll target: it carries the scroll-margin
    // that clears the overlaid section chip.
    expect(targets).toEqual([card("A").closest(".trial-card-wrapper")]);
    restore();
  });

  it("also covers the last-card path (ArrowDown → + New → ArrowUp)", () => {
    const { targets, restore } = spyOnScroll();
    const { card, newCard } = setup({ selectedStart: "C" }); // C is the LAST card
    fireEvent.keyDown(card("C"), { key: "ArrowDown" }); // last card → + New
    targets.length = 0;
    fireEvent.keyDown(newCard() as HTMLElement, { key: "ArrowUp" }); // back onto C (no-op select)
    expect(targets).toEqual([card("C").closest(".trial-card-wrapper")]);
    restore();
  });

  it("does NOT double-scroll when the selection DOES change (the effect owns that case)", () => {
    // Moving between two different cards changes the selection, so useScrollSelectedTrialIntoView
    // handles the scroll; the hook must not also scroll, or the card gets two competing glides.
    const { targets, restore } = spyOnScroll();
    const { card } = setup({ selectedStart: "A" });
    targets.length = 0;
    fireEvent.keyDown(card("A"), { key: "ArrowDown" }); // A → B: selection changes
    expect(targets).toEqual([]);
    restore();
  });
});

describe("useTrialsKeyboardNav — focus after add", () => {
  it("focusAddedTrial moves focus to the newly created (now selected) card", () => {
    const { getByRole } = setup({ start: ["A"], selectedStart: "A" });
    fireEvent.click(getByRole("button", { name: "Add new trial" }));
    // A second option now exists and holds focus.
    const b = getByRole("option", { name: "Trial B" });
    expect(focusedLabel()).toBe("Trial B");
    expect(b).toHaveAttribute("tabindex", "0");
  });

  it("focuses the new card even when the add hits the cap and removes the + New card", () => {
    const { getByRole, queryByRole } = setup({
      start: ["A", "B"],
      selectedStart: "B",
      maxTrials: 3,
    });
    fireEvent.click(getByRole("button", { name: "Add new trial" }));
    expect(queryByRole("button", { name: "Add new trial" })).toBeNull(); // capped
    expect(focusedLabel()).toBe("Trial C"); // focus not stranded
  });
});
