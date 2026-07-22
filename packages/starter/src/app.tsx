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
import { applySnapshot, getSnapshot, onAction, onSnapshot } from "mobx-state-tree";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataPanel } from "./components/data-panel";
import { SimulationView } from "./components/simulation-view";
import { TrialsPanel } from "./components/trials-panel/trials-panel";
import { createRootStore, RootStoreProvider, type RootStoreSnapshotOut } from "./stores/root-store";
import { migrateSavedState, type SavedState, toSavedState } from "./stores/saved-state";

import "./app.scss";

/**
 * Starter simulation — a random-walk model and the template for new sims.
 *
 * TWO-LAYER STATE MODEL: MST owns the trial LIST — what trials exist, which is selected, each trial's
 * recorded input/output. The per-frame transient run state (live walker positions, frame counter)
 * stays in `<SimulationView>`'s `useModelState` / `useSimulationRunner`, NOT in MST. MST did not
 * replace those hooks; the two layers do different jobs.
 *
 * Live data flow: `SimulationView`'s `useModelState` holds the in-progress `transient` locally for
 * per-frame perf, but the Data panel's chart needs the avg-distance series as it grows. App hoists
 * just that slice via `onProgress` into `liveSeries` state (React state, NOT MST — it's per-frame
 * transient) and forwards it to `DataPanel`. The panel prefers the live series while set; once a trial
 * completes (or selection / reset fires) `liveSeries` is cleared (see the three subscriptions below)
 * and the panel falls back to the trial's recorded `output.avgDistanceSeries`.
 */
export const App = observer(function App() {
  const rootStore = useMemo(() => createRootStore({ rng: Math.random }), []);
  // Most-recent in-progress avg-distance series from the running trial, or null when no run is
  // active. Cleared on every trial-list-mutating boundary so the Data panel never shows a stale
  // series belonging to a different (or cancelled) run — see the three subscriptions below.
  const [liveSeries, setLiveSeries] = useState<number[] | null>(null);

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

  // THREE subscriptions clear `liveSeries`. The mutations now happen inside <TrialsPanel> and
  // TrialModel, so App bridges them via store subscriptions rather than callbacks:

  // 1. selection change — covers select-from-card, keyboard nav, AND the post-add auto-select.
  useEffect(
    () =>
      reaction(
        () => rootStore.ui.selectedTrialLetter,
        () => setLiveSeries(null),
      ),
    [rootStore],
  );
  // 2. active trial's output transitions — covers complete (null → output) AND resetting a
  //    COMPLETED trial (output → null).
  useEffect(
    () =>
      reaction(
        () => rootStore.activeTrial.output,
        () => setLiveSeries(null),
      ),
    [rootStore],
  );

  // 3. resetTrial action invocation — catches resetting a trial MID-RUN, where `output` was
  //    already null and stays null, so reaction #2 never fires. `onAction` fires on the action
  //    call regardless of any state diff; filter to `resetTrial` so other actions don't clear.
  useEffect(
    () =>
      onAction(rootStore, (call) => {
        if (call.name === "resetTrial") setLiveSeries(null);
      }),
    [rootStore],
  );

  // Warn before unload once any trial has been run — standalone only. When embedded, AP persists
  // every change, so the prompt would be wrong and would fire during AP's own navigation.
  useReloadWarning(!isEmbedded && rootStore.hasAnyProgress);

  const handleProgress = useCallback((series: readonly number[]) => {
    // The runner emits a fresh array per sample; copy defensively to keep the state value
    // immutable from this side of the callback boundary.
    setLiveSeries([...series]);
  }, []);

  const activeTrial = rootStore.activeTrial;
  const selectedLetter = rootStore.ui.selectedTrialLetter;

  return (
    <RootStoreProvider store={rootStore}>
      {/* One shared polite live region for the sim's narration. For now it carries the
          trials-panel reset / max-trials-cap announcements; future narration should route
          through the same channel. */}
      <Announcer>
        <SimulationFrame
          simTitle="Random Walk"
          tagline="An interactive starter simulation"
          infoModalContent={
            <p>
              This is the Mass Sims starter simulation — a small random-walk model that serves as
              the template for new sims. Adjust the parameters, run trials, and observe how the
              population disperses over time.
            </p>
          }
          standalone={!isEmbedded}
        >
          <SimulationFrame.Trials>
            <TrialsPanel />
          </SimulationFrame.Trials>

          <SimulationFrame.Simulation instruction="Choose parameters, then press Play">
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
              onProgress={handleProgress}
            />
          </SimulationFrame.Simulation>

          <SimulationFrame.Data>
            <DataPanel trial={activeTrial} liveSeries={liveSeries} />
          </SimulationFrame.Data>
        </SimulationFrame>
      </Announcer>
    </RootStoreProvider>
  );
});
