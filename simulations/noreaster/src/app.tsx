import { setInteractiveState, useInitMessage } from "@concord-consortium/lara-interactive-api";
import {
  Announcer,
  inIframe,
  SimulationFrame,
  TRIAL_LETTERS_DEFAULT,
  useReloadWarning,
} from "@concord-consortium/mass-sims-shared";
import { reaction } from "mobx";
import { observer } from "mobx-react-lite";
import { applySnapshot, getSnapshot, onSnapshot } from "mobx-state-tree";
import { useEffect, useMemo } from "react";
import { AboutContent } from "./components/about";
import { TrialsPanel } from "./components/trials-panel/trials-panel";
import { createRootStore, RootStoreProvider, type RootStoreSnapshotOut } from "./stores/root-store";
import { migrateSavedState, type SavedState, toSavedState } from "./stores/saved-state";

import "./app.scss";

/**
 * Nor'easter simulation shell.
 *
 * The Simulation and Data panels are intentionally empty section shells right now — their
 * Nor'easter-specific content arrives in later stories. The Trials column runs on the shared
 * trial-list infrastructure, which stays as the placeholder until that content lands.
 *
 * TWO-LAYER STATE MODEL: MST owns the trial LIST — what trials exist, which is selected, each trial's
 * recorded input/output. The per-frame transient run state of a running trial belongs in the (future)
 * Simulation panel's own hooks, NOT in MST; the two layers do different jobs.
 */
export const App = observer(function App() {
  const rootStore = useMemo(() => createRootStore({ rng: Math.random }), []);

  // AP saved-state sync: restore on init, push on change. Standalone-safe — outside AP,
  // useInitMessage stays null and setInteractiveState is a no-op. See infra-plan §3.
  const initMsg = useInitMessage<SavedState>();
  // Embedded = running inside AP (or any iframe host).
  const isEmbedded = initMsg !== null || inIframe();

  // Defensive normalization: if `selectedTrialLetter` ever names a trial that doesn't exist (e.g. a
  // restored saved state whose active letter wasn't among its trials), re-select the first available
  // letter. Set up BEFORE the hydrate effect so the reaction is already observing when applySnapshot
  // writes the restored letter. `activeTrial` falls back on the read side too; this fixes the stored
  // letter so the matching card shows selected.
  useEffect(() => {
    return reaction(
      () => ({
        letter: rootStore.ui.selectedTrialLetter,
        exists: rootStore.trials.has(rootStore.ui.selectedTrialLetter),
      }),
      ({ exists }) => {
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

  // Warn before unload once any trial has progress — standalone only. When embedded, AP persists
  // every change, so the prompt would be wrong and would fire during AP's own navigation.
  useReloadWarning(!isEmbedded && rootStore.hasAnyProgress);

  return (
    <RootStoreProvider store={rootStore}>
      {/* One shared polite live region for the sim's narration. For now it carries the
          trials-panel reset / max-trials-cap announcements; future narration should route
          through the same channel. */}
      <Announcer>
        <SimulationFrame
          simTitle="Nor’easter"
          tagline="Which air masses create a nor’easter?"
          infoModalContent={<AboutContent />}
          standalone={!isEmbedded}
        >
          <SimulationFrame.Trials>
            <TrialsPanel />
          </SimulationFrame.Trials>

          {/* Empty section shells — the Nor'easter simulation and data content are added in
              later stories. */}
          <SimulationFrame.Simulation instruction="Set up the air masses to begin" />

          <SimulationFrame.Data />
        </SimulationFrame>
      </Announcer>
    </RootStoreProvider>
  );
});
