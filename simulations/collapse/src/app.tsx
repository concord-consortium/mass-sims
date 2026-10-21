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
 * Collapse! simulation — still the Starter random-walk model until the real model replaces it.
 *
 * TWO-LAYER STATE MODEL: MST owns the trial LIST — what trials exist, which is selected, each trial's
 * recorded input/output. The per-frame transient run state (live walker positions, frame counter)
 * stays in `<SimulationView>`'s `useModelState` / `useSimulationRunner`, NOT in MST. MST did not
 * replace those hooks; the two layers do different jobs.
 *
 * Collapse has no Data slot: without `<SimulationFrame.Data>` the shared frame lays out two columns
 * (Trials + Simulation).
 */
export const App = observer(function App() {
  const rootStore = useMemo(() => createRootStore({ rng: Math.random }), []);

  // AP saved-state sync: restore on init, push on change. Standalone-safe — outside AP,
  // useInitMessage stays null and setInteractiveState is a no-op. See infra-plan §3.
  const initMsg = useInitMessage<SavedState>();
  // Embedded = running inside AP (or any iframe host).
  const isEmbedded = initMsg !== null || inIframe();

  // Tell the host (Activity Player) our render height so it doesn't leave white space below the
  // embedded sim. No-op when standalone.
  useReportHeight(isEmbedded);

  // Defensive normalization: if `selectedTrialLetter` ever names a trial that doesn't exist (e.g. a
  // restored saved state whose active letter wasn't among its trials), re-select the first available
  // letter. Set up BEFORE the hydrate effect so the reaction is already observing when applySnapshot
  // writes the restored letter. `activeTrial` falls back on the read side too; this fixes the stored
  // letter so the matching card shows selected.
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

  // Hydrate from LARA's saved state once it arrives. Construct the MST snapshot shape explicitly —
  // the wire format (`{ version, trials, selectedTrialLetter }`) is NOT the store snapshot
  // (`{ trials, ui: {...} }`), so we project from one to the other.
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

  // Persist the store to LARA as the `{ version, trials, selectedTrialLetter }` projection. Watch the
  // whole store via `onSnapshot` (fires on the actual snapshot-emit boundary), with an explicit
  // initial save on mount and a serialized-payload dedup so identical payloads aren't re-emitted.
  useEffect(() => {
    let lastSaved = "";
    const save = (snap: RootStoreSnapshotOut) => {
      const state = toSavedState(snap);
      const serialized = JSON.stringify(state);
      if (serialized === lastSaved) return;
      lastSaved = serialized;
      setInteractiveState<SavedState>(state);
    };
    save(getSnapshot(rootStore)); // initial save on mount
    return onSnapshot(rootStore, save);
  }, [rootStore]);

  // Warn before unload once any trial has been run — standalone only. When embedded, AP persists
  // every change, so the prompt would be wrong and would fire during AP's own navigation.
  useReloadWarning(!isEmbedded && rootStore.hasAnyProgress);

  const activeTrial = rootStore.activeTrial;
  const selectedLetter = rootStore.ui.selectedTrialLetter;

  return (
    <RootStoreProvider store={rootStore}>
      {/* One shared polite live region for the sim's narration. For now it carries the
          trials-panel reset / max-trials-cap announcements; future narration should route
          through the same channel. */}
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
            {/*
            The `key` forces <SimulationView> to remount whenever the selected trial changes OR the
            active trial's output transitions between empty and done. This matters because
            <SimulationView>'s `useModelState` only consumes initial input values on MOUNT — without
            the remount, switching trials or resetting would leave stale per-frame transient state.
            Sourcing the key from store reads is fine; dropping it is a stale-input bug.
          */}
            <SimulationView
              key={`${selectedLetter}:${activeTrial.output ? "done" : "empty"}`}
              trial={activeTrial}
              trialLabel={selectedLetter}
              onInputChange={(input) => activeTrial.setInput(input)}
              onComplete={(output, finalTransient) => activeTrial.setOutput(output, finalTransient)}
              onReset={() => rootStore.resetTrial()}
            />
          </SimulationFrame.Simulation>
        </SimulationFrame>
      </Announcer>
    </RootStoreProvider>
  );
});
