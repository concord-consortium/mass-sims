import { setInteractiveState, useInitMessage } from "@concord-consortium/lara-interactive-api";
import { SimulationFrame, useReloadWarning } from "@concord-consortium/mass-sims-shared";
import { useEffect, useState } from "react";
import { AboutContent } from "./components/about";
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
  const initMsg = useInitMessage<SavedState>();
  const isEmbedded = initMsg !== null;

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

  const onResetTrial = () => setTrial(emptyTrial());

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
          onSelectParent1={onSelectParent1}
          onSelectParent2={onSelectParent2}
          onCrossPlants={onCrossPlants}
          onSetFungus={onSetFungus}
          onResetTrial={onResetTrial}
        />
      </SimulationFrame.Simulation>
      <SimulationFrame.Data />
    </SimulationFrame>
  );
}
