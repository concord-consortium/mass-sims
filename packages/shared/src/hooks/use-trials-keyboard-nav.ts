import { type FocusEvent, type KeyboardEvent, type RefObject, useEffect, useState } from "react";
import { smoothScrollIntoView } from "../utils/reduced-motion";

export interface UseTrialsKeyboardNavOptions<T extends HTMLElement> {
  containerRef: RefObject<T | null>;
  letters: readonly string[];
  selectedIndex: number;
  canAddTrial: boolean;
  selectLetter: (letter: string) => void;
}

export interface TrialsKeyboardNav {
  /**
   * Attach to BOTH the listbox (delegates for the cards) and the `+ New` card, which lives outside
   * the listbox. Queries off `containerRef`, not the event target, so either attachment point works.
   */
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  onFocus: (e: FocusEvent<HTMLElement>) => void;
  selectedCardTabIndex: number;
  newCardTabIndex: number;
  resetTabIndex: number;
  focusAddedTrial: () => void;
}

/**
 * Roving-tabindex keyboard navigation for the Trials column, shared across every sim.
 *
 * The trial cards are a `role="listbox"` of `option`s, but the `+ New` card is a focusable
 * non-option that must live OUTSIDE the listbox (a listbox must not own focusable non-options — see
 * docs/accessibility.md). To make the whole column a *single* tab stop, the cards and the `+ New`
 * card share one roving tab stop, and the `+ New` card joins the arrow-key navigation ring as the
 * element just past the last option:
 *
 *   … ↓ last card ↓ (+ New) ↓ first card ↓ …   (ArrowUp is the mirror; the ring wraps)
 *
 * so ArrowDown from the last card and ArrowUp from the first card both land on `+ New`, and `End`
 * jumps to it (`Home` to the first card). Moving onto `+ New` moves focus only — it isn't
 * selectable — while moving onto a real card selects it (selection-follows-focus, as before).
 *
 * Because the tab stop can sit on either member, exactly one of {selected card, `+ New` card} is
 * tabbable at a time; the panel reset (rendered over the selected card) shares the "options" tab
 * stop, so Tab from a card reaches its reset and Tab from `+ New` skips straight past it. `onFocus`
 * keeps this in sync with real focus so a click or a Tab-in updates the tab stop too.
 *
 * @typeParam T - the panel container element type (matches the ref from `useScrollSelectedTrialIntoView`).
 */
export function useTrialsKeyboardNav<T extends HTMLElement>({
  containerRef,
  letters,
  selectedIndex,
  canAddTrial,
  selectLetter,
}: UseTrialsKeyboardNavOptions<T>): TrialsKeyboardNav {
  const [focusTarget, setFocusTarget] = useState<"options" | "new">("options");
  const onNew = focusTarget === "new" && canAddTrial;
  // Bumped by `focusAddedTrial`; drives the post-add focus effect below. A monotonic token (not
  // `selectedIndex`) is the trigger so the effect fires even when the new card lands at the same
  // index the selection already had, and never fires on an ordinary selection change.
  const [addFocusToken, setAddFocusToken] = useState(0);
  const focusAddedTrial = () => setAddFocusToken((n) => n + 1);

  // After an add re-renders the panel, move focus to the newly created (now selected) card so the
  // caller's `selectLetter` and this focus move stay together. Focusing it fires `onFocus`, which
  // pulls the tab stop back to the options.
  // biome-ignore lint/correctness/useExhaustiveDependencies: addFocusToken is the intended trigger; selectedIndex/containerRef are read at fire time, not deps.
  useEffect(() => {
    if (addFocusToken === 0) return;
    const cards = containerRef.current?.querySelectorAll<HTMLButtonElement>(".trial-card");
    cards?.[selectedIndex]?.focus({ preventScroll: true });
  }, [addFocusToken]);

  // Keep the roving tab stop in sync with wherever focus actually lands — arrow nav, a card click,
  // or a Tab into the column. Only ever MOVES the tab stop toward the focused member: focus leaving
  // the column (onto the reset button, which matches neither selector, or out entirely) doesn't
  // reset it, so the group remembers its position.
  const onFocus = (e: FocusEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest(".new-trial-card")) setFocusTarget("new");
    else if (target.closest(".trial-card")) setFocusTarget("options");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    const onNewCard = !!target.closest(".new-trial-card");

    const container = containerRef.current;
    if (!container) return;
    const cards = Array.from(container.querySelectorAll<HTMLButtonElement>(".trial-card"));
    // The `+ New` card sits one past the last option in the ring, present only below the cap.
    const newIndex = cards.length;
    const ringLength = cards.length + (canAddTrial ? 1 : 0);
    if (ringLength === 0) return;

    // Which roving member the key came from. A keydown from anything else — the reset button, or
    // container chrome if a consumer delegates from a wrapper rather than the listbox — matches no
    // card, so `indexOf` yields -1 and the key is ignored. This is the ONLY membership check;
    // don't add an earlier `closest()` early-out, which would be redundant with it.
    const current = onNewCard
      ? newIndex
      : cards.indexOf(target.closest(".trial-card") as HTMLButtonElement);
    if (current < 0) return;

    let next: number;
    switch (e.key) {
      case "ArrowDown":
        next = (current + 1) % ringLength;
        break;
      case "ArrowUp":
        next = (current - 1 + ringLength) % ringLength;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = ringLength - 1;
        break;
      default:
        return;
    }
    e.preventDefault();

    if (canAddTrial && next === newIndex) {
      // Moving to the `+ New` card: focus only, no selection change (it isn't selectable). Scroll it
      // into view ourselves — with no selection change, useScrollSelectedTrialIntoView won't.
      const newCard = container.querySelector<HTMLElement>(".new-trial-card");
      if (newCard) {
        newCard.focus({ preventScroll: true });
        smoothScrollIntoView(newCard);
      }
      return;
    }

    // Moving to a real option: select it (selection follows focus) and move focus. focus() works
    // regardless of tabIndex; preventScroll defers scrolling to useScrollSelectedTrialIntoView's
    // smooth glide so keyboard nav matches a mouse selection.
    const letter = letters[next];
    if (letter) selectLetter(letter);
    cards[next]?.focus({ preventScroll: true });
  };

  return {
    onKeyDown,
    onFocus,
    selectedCardTabIndex: onNew ? -1 : 0,
    newCardTabIndex: onNew ? 0 : -1,
    resetTabIndex: onNew ? -1 : 0,
    focusAddedTrial,
  };
}
