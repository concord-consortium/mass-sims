import { setInteractiveState, useInitMessage } from "@concord-consortium/lara-interactive-api";
import {
  Announcer,
  inIframe,
  SimulationFrame,
  TRIAL_LETTERS_DEFAULT,
  useReloadWarning,
  useReportHeight,
} from "@concord-consortium/mass-sims-shared";
import { reaction } from "mobx";
import { observer } from "mobx-react-lite";
import { applySnapshot, getSnapshot, onSnapshot } from "mobx-state-tree";
import { useEffect, useMemo } from "react";
import { SimulationView } from "./components/simulation-view";
import { TrialsPanel } from "./components/trials-panel/trials-panel";
import { createRootStore, RootStoreProvider, type RootStoreSnapshotOut } from "./stores/root-store";
import { migrateSavedState, type SavedState, toSavedState } from "./stores/saved-state";

import "./app.scss";

/**
 * Collapse! simulation. Until the model story, the trial store keeps the placeholder random-walk
 * `input` / `output` shape and `<SimulationView>` is layout only.
 *
 * MST owns the trial list: which trials exist, which is selected, and each one's recorded result.
 * Per-frame run state will live in `<SimulationView>` (`useModelState` / `useSimulationRunner`),
 * not in MST.
 */
export const App = observer(function App() {
  const rootStore = useMemo(() => createRootStore({ rng: Math.random }), []);

  // Outside AP, `useInitMessage` stays null and `setInteractiveState` is a no-op.
  const initMsg = useInitMessage<SavedState>();
  const isEmbedded = initMsg !== null || inIframe();

  useReportHeight(isEmbedded);

  // Safety net: if the selected letter names no trial, select the first one, so a card always shows
  // as selected. Registered before the hydrate effect so it already observes the letter that
  // `applySnapshot` writes.
  useEffect(() => {
    return reaction(
      () => rootStore.trials.has(rootStore.ui.selectedTrialLetter),
      (exists) => {
        if (!exists) {
          const first = rootStore.trialLetters.find((l) =>
            (TRIAL_LETTERS_DEFAULT as readonly string[]).includes(l),
          );
          if (first) rootStore.ui.selectTrial(first);
        }
      },
    );
  }, [rootStore]);

  // The saved-state format `{ version, trials, selectedTrialLetter }` differs from the store
  // snapshot `{ trials, ui }`, so map one onto the other.
  useEffect(() => {
    if (initMsg && "interactiveState" in initMsg && initMsg.interactiveState) {
      const state = migrateSavedState(initMsg.interactiveState, Math.random);
      if (state) {
        applySnapshot(rootStore, {
          trials: state.trials,
          ui: { selectedTrialLetter: state.selectedTrialLetter },
        });
      }
    }
  }, [initMsg, rootStore]);

  // Save on mount and on every store snapshot, skipping a payload identical to the last one sent.
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

  // Standalone only: when embedded, AP saves every change, and the prompt would fire during AP's
  // own navigation.
  useReloadWarning(!isEmbedded && rootStore.hasAnyProgress);

  const activeTrial = rootStore.activeTrial;
  const selectedLetter = rootStore.ui.selectedTrialLetter;

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
            {/* Remounts the view when the selection or the active trial's done state changes. The
                layout-only view doesn't need this yet; the model story's per-trial state will. */}
            <SimulationView key={`${selectedLetter}:${activeTrial.output ? "done" : "empty"}`} />
          </SimulationFrame.Simulation>
        </SimulationFrame>
      </Announcer>
    </RootStoreProvider>
  );
});
