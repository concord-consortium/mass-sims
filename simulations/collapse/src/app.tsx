import { setInteractiveState, useInitMessage } from "@concord-consortium/lara-interactive-api";
import {
  Announcer,
  inIframe,
  SimulationFrame,
  useReloadWarning,
  useReportHeight,
} from "@concord-consortium/mass-sims-shared";
import { observer } from "mobx-react-lite";
import { applySnapshot, getSnapshot, onSnapshot } from "mobx-state-tree";
import { useEffect, useMemo } from "react";
import { SimulationView } from "./components/simulation-view";
import { TrialsPanel } from "./components/trials-panel/trials-panel";
import { createRootStore, RootStoreProvider, type RootStoreSnapshotOut } from "./stores/root-store";
import { migrateSavedState, type SavedState, toSavedState } from "./stores/saved-state";

import "./app.scss";

/**
 * Collapse! simulation.
 *
 * MST owns the trial list: which trials exist, which is selected, and each trial's samples (the
 * rows of its data table).
 */
export const App = observer(function App() {
  const rootStore = useMemo(() => createRootStore({ rng: Math.random }), []);

  // Outside AP, `useInitMessage` stays null and `setInteractiveState` is a no-op.
  const initMsg = useInitMessage<SavedState>();
  const isEmbedded = initMsg !== null || inIframe();

  useReportHeight(isEmbedded);

  // The saved-state format `{ version, trials, selectedTrialLetter }` differs from the store
  // snapshot `{ trials, ui }`, so map one onto the other.
  useEffect(() => {
    if (initMsg && "interactiveState" in initMsg && initMsg.interactiveState) {
      const state = migrateSavedState(initMsg.interactiveState);
      if (state) {
        applySnapshot(rootStore, {
          trials: state.trials,
          ui: { selectedTrialLetter: state.selectedTrialLetter },
        });
      }
    }
  }, [initMsg, rootStore]);

  // Send the `{ version, trials, selectedTrialLetter }` projection to AP once its init message
  // arrives (none comes in standalone mode), then on every store snapshot, skipping a payload
  // identical to the last one sent. The hydrate effect above runs first, so AP first gets the
  // restored state.
  useEffect(() => {
    if (initMsg === null) return;
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
  }, [initMsg, rootStore]);

  // Standalone only: when embedded, AP saves every change, and the prompt would fire during AP's
  // own navigation.
  useReloadWarning(!isEmbedded && rootStore.hasAnyProgress);

  return (
    <RootStoreProvider store={rootStore}>
      {/* The sim's single polite live region: route all narration through it. */}
      <Announcer>
        <SimulationFrame
          simTitle="Collapse!"
          tagline="Which conditions form caves?"
          infoModalContent={
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
              incididunt ut labore et dolore magna aliqua.
            </p>
          }
          standalone={!isEmbedded}
        >
          <SimulationFrame.Trials>
            <TrialsPanel />
          </SimulationFrame.Trials>

          <SimulationFrame.Simulation instruction="Select a trial, then sample through time">
            <SimulationView />
          </SimulationFrame.Simulation>
        </SimulationFrame>
      </Announcer>
    </RootStoreProvider>
  );
});
