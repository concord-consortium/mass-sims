import { setInteractiveState, useInitMessage } from "@concord-consortium/lara-interactive-api";
import { SimulationFrame, useReloadWarning } from "@concord-consortium/mass-sims-shared";
import { reaction } from "mobx";
import { observer } from "mobx-react-lite";
import { applySnapshot, getSnapshot } from "mobx-state-tree";
import { useEffect, useMemo, useRef } from "react";
import { AboutContent } from "./components/about";
import { BananasDataPanel } from "./components/data-panel/data-panel";
import { SimulationPanel } from "./components/simulation-panel";
import { createRootStore, RootStoreProvider } from "./stores/root-store";
import type { SavedState } from "./stores/trial-model";

import "./app.scss";

interface AppProps {
  /** RNG injection seam for crosses. Defaults to `Math.random`; tests pass a seeded PRNG. */
  rng?: () => number;
}

export const App = observer(function App({ rng = Math.random }: AppProps = {}) {
  const rootStore = useMemo(() => createRootStore({ rng }), [rng]);
  const initMsg = useInitMessage<SavedState>();
  const isEmbedded = initMsg !== null;

  // Ref to the Sim panel's offspring-grid scroller. App-owned so the Data panel's pill chip
  // can scroll the Sim's grid into view without either panel knowing about the other.
  const gridRef = useRef<HTMLElement>(null);

  // Hydrate from LARA's saved state once it arrives. The AP-provided state is authoritative: it
  // overwrites any trial edits made between mount and init landing.
  useEffect(() => {
    if (initMsg && "interactiveState" in initMsg && initMsg.interactiveState) {
      applySnapshot(rootStore.trial, initMsg.interactiveState);
    }
  }, [initMsg, rootStore]);

  // Persist trial snapshots back to LARA. `fireImmediately` saves the initial empty trial on
  // mount, not only on subsequent changes.
  useEffect(() => {
    return reaction(
      () => getSnapshot(rootStore.trial),
      (snap) => setInteractiveState<SavedState>(snap as SavedState),
      { fireImmediately: true },
    );
  }, [rootStore]);

  // Clear a now-out-of-range selectedCross whenever the cross count shrinks.
  useEffect(() => {
    return reaction(
      () => rootStore.trial.crosses.length,
      () => rootStore.normalizeSelection(),
    );
  }, [rootStore]);

  // Reload-warning: standalone only, gated on "has progress", now sourced from the trial view.
  const hasProgress = rootStore.trial.canReset;
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
      >
        <SimulationFrame.Trials />
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
