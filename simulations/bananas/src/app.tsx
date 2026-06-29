import { setInteractiveState, useInitMessage } from "@concord-consortium/lara-interactive-api";
import {
  SimulationFrame,
  TRIAL_LETTERS_DEFAULT as TRIAL_LETTERS,
  useLogEvent,
  useReloadWarning,
} from "@concord-consortium/mass-sims-shared";
import { reaction } from "mobx";
import { observer } from "mobx-react-lite";
import { applySnapshot, getSnapshot, onSnapshot } from "mobx-state-tree";
import { useCallback, useEffect, useRef, useState } from "react";
import { AboutContent } from "./components/about";
import { BananasDataPanel } from "./components/data-panel/data-panel";
import { SimulationPanel } from "./components/simulation-panel";
import { TrialsPanel } from "./components/trials-panel/trials-panel";
import { createRootStore, RootStoreProvider, type RootStoreSnapshotOut } from "./stores/root-store";
import { migrateSavedState, type SavedState, toSavedState } from "./stores/saved-state";

import "./app.scss";

interface AppProps {
  /** RNG injection seam for crosses. Defaults to `Math.random`; tests pass a seeded PRNG. */
  rng?: () => number;
}

export const App = observer(function App({ rng = Math.random }: AppProps = {}) {
  const [rootStore] = useState(() => createRootStore({ rng }));
  const initMsg = useInitMessage<SavedState>();
  const isEmbedded = initMsg !== null;

  // About / info modal open & close logging. Memoized so the SimulationFrame's notification effect
  // isn't re-subscribed on every App re-render (logEvent itself is a stable callback).
  const logEvent = useLogEvent();
  const handleInfoOpenChange = useCallback(
    (open: boolean) => logEvent(open ? "info_modal_opened" : "info_modal_closed"),
    [logEvent],
  );

  // Ref to the Sim panel's offspring-grid scroller. App-owned so the Data panel's pill chip
  // can scroll the Sim's grid into view without either panel knowing about the other.
  const gridRef = useRef<HTMLElement>(null);

  // Hydrate from LARA's saved state once it arrives. The AP-provided state is authoritative: it
  // overwrites any edits made between mount and init landing. Applied to the whole root store so
  // every saved trial (and the active letter) restores; UI-only cross-selection starts empty.
  useEffect(() => {
    if (initMsg && "interactiveState" in initMsg && initMsg.interactiveState) {
      // Validate before applying — a malformed/corrupt payload would otherwise throw inside
      // applySnapshot (bad letter → enumeration; bad trial → model). null → keep the seeded store.
      const state = migrateSavedState(initMsg.interactiveState);
      if (state) {
        applySnapshot(rootStore, {
          trials: state.trials,
          ui: { selectedTrialLetter: state.selectedTrialLetter, selectedCrossByTrial: {} },
        });
      }
    }
  }, [initMsg, rootStore]);

  // Persist the whole store to LARA as the `{ trials, selectedTrialLetter }` projection. We watch
  // the entire rootStore so adding or selecting a trial triggers a save, but skip redundant writes:
  // transient UI-only changes (e.g. selecting a cross row, which `toSavedState` drops) would
  // otherwise re-emit an identical payload on every click. `onSnapshot` fires only on changes after
  // setup, so the explicit initial call saves the starting state on mount.
  useEffect(() => {
    let lastSaved = "";
    const save = (snap: RootStoreSnapshotOut) => {
      const state = toSavedState(snap);
      const serialized = JSON.stringify(state);
      if (serialized === lastSaved) return;
      lastSaved = serialized;
      setInteractiveState<SavedState>(state);
    };
    save(getSnapshot(rootStore));
    return onSnapshot(rootStore, save);
  }, [rootStore]);

  // Defensive normalization: if `selectedTrialLetter` ever points at a trial that doesn't exist,
  // fall back to the first available letter (always "A" in practice). Can't happen via locked
  // actions; belt-and-suspenders alongside the `activeTrial` view's own fallback.
  useEffect(() => {
    return reaction(
      () => ({
        letter: rootStore.ui.selectedTrialLetter,
        exists: rootStore.trials.has(rootStore.ui.selectedTrialLetter),
      }),
      ({ exists }) => {
        if (!exists) {
          // Pick the first *valid* letter (A–J). Via locked actions every key is already a letter,
          // so this equals keys()[0]; the guard only matters if a malformed hydrate left a non-A–J
          // key, which `selectTrial` (an enumeration write) would otherwise throw on.
          const first = rootStore.trialLetters.find((l) =>
            (TRIAL_LETTERS as readonly string[]).includes(l),
          );
          if (first) rootStore.ui.selectTrial(first);
        }
      },
    );
  }, [rootStore]);

  // Reload-warning: standalone only, fires if ANY trial has progress (not just the active one), so
  // switching trials never changes whether the unload warning shows.
  const hasProgress = rootStore.hasAnyProgress;
  useReloadWarning(!isEmbedded && hasProgress);

  // Scroll the offspring grid so the row for `idx` is visible. Only scrolls if the row is
  // above or below the current viewport. Respects prefers-reduced-motion.
  const scrollToCross = (idx: number) => {
    const grid = gridRef.current;
    if (!grid) return;
    const rows = grid.querySelectorAll<HTMLElement>(".offspring-row");
    const target = rows[idx];
    if (!target) return;
    const cs = getComputedStyle(grid);
    const padTop = parseFloat(cs.paddingTop);
    const padBottom = parseFloat(cs.paddingBottom);
    const cRect = grid.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
    if (tRect.top < cRect.top + padTop) {
      grid.scrollBy({ top: tRect.top - cRect.top - padTop, behavior });
    } else if (tRect.bottom > cRect.bottom - padBottom) {
      grid.scrollBy({ top: tRect.bottom - cRect.bottom + padBottom, behavior });
    }
  };

  // Data-panel chip click handler — scrolls the selected row into view. Reads the bounds-checked
  // `activeCross` (never the raw stored selection index — see the Selection access contract); the DOM
  // coordination (gridRef) lives at App level, so App bridges the two.
  const onPillChipClick = () => {
    const idx = rootStore.activeCross;
    if (idx !== null) scrollToCross(idx);
  };

  return (
    <RootStoreProvider store={rootStore}>
      <SimulationFrame
        simTitle="Bananas"
        tagline="An interactive genetics simulation"
        infoModalContent={<AboutContent />}
        onInfoOpenChange={handleInfoOpenChange}
      >
        <SimulationFrame.Trials>
          <TrialsPanel />
        </SimulationFrame.Trials>
        <SimulationFrame.Simulation instruction="Select two parents to begin">
          <SimulationPanel gridRef={gridRef} />
        </SimulationFrame.Simulation>
        <SimulationFrame.Data>
          <BananasDataPanel onPillChipClick={onPillChipClick} />
        </SimulationFrame.Data>
      </SimulationFrame>
    </RootStoreProvider>
  );
});
