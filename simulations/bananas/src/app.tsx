import { setInteractiveState, useInitMessage } from "@concord-consortium/lara-interactive-api";
import { SimulationFrame, useReloadWarning } from "@concord-consortium/mass-sims-shared";
import { useEffect, useRef, useState } from "react";
import { AboutContent } from "./components/about";
import { BananasDataPanel } from "./components/data-panel/data-panel";
import { SimulationPanel } from "./components/simulation-panel";
import { MAX_CROSSES, makeCross, type ParentId } from "./model/genetics";
import { emptyTrial, type SavedState, type TrialState } from "./model/trial";

import "./app.scss";

interface AppProps {
  /** RNG injection seam for crosses. Defaults to `Math.random`; tests pass a seeded PRNG. */
  rng?: () => number;
}

export function App({ rng = Math.random }: AppProps = {}) {
  const [trial, setTrial] = useState<TrialState>(emptyTrial);
  const [selectedCross, setSelectedCross] = useState<number | null>(null);
  const initMsg = useInitMessage<SavedState>();
  const isEmbedded = initMsg !== null;

  // Ref to the Sim panel's offspring-grid scroller. App-owned so the Data panel's pill chip
  // can scroll the Sim's grid into view without either panel knowing about the other.
  const gridRef = useRef<HTMLElement>(null);

  const onSelectCross = (idx: number | null) => setSelectedCross(idx);
  const onClearSelection = () => setSelectedCross(null);

  // Scroll the offspring grid so the row for `idx` is visible. Only scrolls if the row is
  // above or below the current viewport). Respects prefers-reduced-motion.
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

  // Data-panel chip click handler — scrolls the selected row into view. Defensive `null` check
  // (the chip only renders when a selection exists, but kept for safety).
  const onPillChipClick = () => {
    if (selectedCross !== null) scrollToCross(selectedCross);
  };

  // Warn before unload once the trial has any progress — standalone only. (When embedded, AP
  // persists every change.)
  const hasProgress = !!(trial.p1 || trial.p2 || trial.fungusOn || trial.crosses.length > 0);
  useReloadWarning(!isEmbedded && hasProgress);

  const onSelectParent1 = (id: ParentId) => setTrial((t) => (t.locked ? t : { ...t, p1: id }));
  const onSelectParent2 = (id: ParentId) => setTrial((t) => (t.locked ? t : { ...t, p2: id }));

  const onCrossPlants = () =>
    setTrial((t) => {
      if (!t.p1 || !t.p2 || t.crosses.length >= MAX_CROSSES) return t;
      const plants = makeCross(t.p1, t.p2, t.fungusOn, rng);
      return { ...t, locked: true, crosses: [...t.crosses, plants] };
    });

  // Defensive guard: ignore writes the UI shouldn't have allowed (no parents, or crossing
  // started). The switch already enforces isFungusLocked; this is the last line of defense.
  const onSetFungus = (value: boolean) =>
    setTrial((t) => (!t.p1 || !t.p2 || t.crosses.length > 0 ? t : { ...t, fungusOn: value }));

  const onResetTrial = () => {
    setTrial(emptyTrial());
    setSelectedCross(null);
  };

  // Out-of-bounds defensive guard: normalize a stale `selectedCross` back to `null` if it ever
  // points past the end of `trial.crosses`. The locked handlers can't produce this, but a future
  // refactor that reorders state updates (or a saved-state restore landing a stale index) could —
  // and chart code indexes `trial.crosses[selectedCross]`, so quietly resetting beats crashing.
  useEffect(() => {
    if (selectedCross !== null && selectedCross >= trial.crosses.length) {
      setSelectedCross(null);
    }
  }, [selectedCross, trial.crosses.length]);

  useEffect(() => {
    if (initMsg && "interactiveState" in initMsg && initMsg.interactiveState) {
      setTrial(initMsg.interactiveState);
    }
  }, [initMsg]);

  useEffect(() => {
    setInteractiveState<SavedState>(trial);
  }, [trial]);

  return (
    <SimulationFrame
      simTitle="Bananas"
      tagline="An interactive genetics simulation"
      infoModalContent={<AboutContent />}
    >
      <SimulationFrame.Trials />
      <SimulationFrame.Simulation instruction="Select two parents to begin">
        <SimulationPanel
          trial={trial}
          selectedCross={selectedCross}
          onSelectCross={onSelectCross}
          gridRef={gridRef}
          onSelectParent1={onSelectParent1}
          onSelectParent2={onSelectParent2}
          onCrossPlants={onCrossPlants}
          onSetFungus={onSetFungus}
          onResetTrial={onResetTrial}
        />
      </SimulationFrame.Simulation>
      <SimulationFrame.Data>
        <BananasDataPanel
          trial={trial}
          selectedCross={selectedCross}
          onClearSelection={onClearSelection}
          onPillChipClick={onPillChipClick}
        />
      </SimulationFrame.Data>
    </SimulationFrame>
  );
}
