import { setInteractiveState, useInitMessage } from "@concord-consortium/lara-interactive-api";
import { SimulationFrame, TrialCard, useReloadWarning } from "@concord-consortium/mass-sims-shared";
import { useCallback, useEffect, useState } from "react";
import { DataPanel } from "./components/data-panel";
import { SimulationView } from "./components/simulation-view";
import type { SavedState } from "./model/saved-state";
import type { RecordedTrial, SimInput, SimOutput, SimTransient } from "./model/types";
import "./app.scss";

const TRIAL_LIMIT = 10; // Matches TrialCard's A–J letter cap.
const DEFAULT_PARAMS = { walkerCount: 50, stepSize: 1, framesPerTrial: 200 } as const;

// Plain Math.random is fine — ids/seeds aren't security-sensitive. Each trial keeps its seed for
// life, so re-running reproduces it exactly while different trials vary.
function makeTrialId(): string {
  return Math.random().toString(36).slice(2, 10);
}
function makeSeed(): string {
  return `trial-${Math.random().toString(36).slice(2, 10)}`;
}
function makeEmptyTrial(): RecordedTrial {
  return {
    id: makeTrialId(),
    input: { ...DEFAULT_PARAMS, seed: makeSeed() },
    output: null,
    finalTransient: null,
  };
}

/**
 * Starter simulation — a random-walk model and the template for new sims. App owns the trial list
 * that both the Trials and Data slots read from. There is always at least one trial: running fills
 * the selected trial; "New" adds an empty one; Reset clears a trial back to empty (never deletes).
 *
 * Live data flow: `SimulationView`'s `useModelState` holds the in-progress `transient` locally
 * for per-frame perf, but the Data panel's chart needs to see the avg-distance series as it grows.
 * App hoists just that one slice via the `onProgress` callback into `liveSeries` state and forwards
 * it to `DataPanel`. The Data panel prefers the live series while it's set; once a trial completes
 * (or the selection / reset / new-trial path fires) `liveSeries` is cleared and the panel falls
 * back to the trial's recorded `output.avgDistanceSeries`.
 */
export function App() {
  // Trials + selected id live in one state object so they update atomically — adding a trial
  // appends it AND selects it in a single update, so the selection can never point at a trial the
  // A–J cap rejected.
  const [{ trials, selectedId }, setState] = useState(() => {
    const first = makeEmptyTrial();
    return { trials: [first], selectedId: first.id };
  });
  // Most-recent in-progress avg-distance series from the running trial, or null when no run is
  // active. Cleared on every trial-list-mutating boundary (select, reset, add, complete) so the
  // Data panel never shows a stale series belonging to a different trial.
  const [liveSeries, setLiveSeries] = useState<number[] | null>(null);

  // AP saved-state sync: restore on init, push on change. Standalone-safe — outside AP,
  // useInitMessage stays null and setInteractiveState is a no-op. See infra-plan §3.
  const initMsg = useInitMessage<SavedState>();
  // Embedded once the AP handshake has delivered an init message; null in standalone.
  const isEmbedded = initMsg !== null;
  useEffect(() => {
    // `"interactiveState" in initMsg` narrows the union to the runtime/report variants;
    // the truthy check skips the first-session null.
    if (initMsg && "interactiveState" in initMsg && initMsg.interactiveState) {
      setState(initMsg.interactiveState);
    }
  }, [initMsg]);
  useEffect(() => {
    // Trials/selectedId change on user actions, not per-frame, so the push rate stays low.
    setInteractiveState<SavedState>({ trials, selectedId });
  }, [trials, selectedId]);

  const selected = trials.find((t) => t.id === selectedId) ?? trials[0];
  // Selected trial's letter (0→A, 1→B, …).
  const selectedLetter = String.fromCharCode(65 + Math.max(0, trials.indexOf(selected)));

  // Warn before unload once a trial has been run — standalone only. When embedded, AP persists
  // every change, so the prompt would be wrong and would fire during AP's own navigation.
  useReloadWarning(!isEmbedded && trials.some((t) => t.output !== null));

  // New trials are built outside the updater (makeEmptyTrial is impure) so the updater stays pure.
  const addTrial = useCallback(() => {
    const trial = makeEmptyTrial();
    setLiveSeries(null);
    setState((prev) =>
      prev.trials.length >= TRIAL_LIMIT // refuse past the A–J cap
        ? prev
        : { trials: [...prev.trials, trial], selectedId: trial.id },
    );
  }, []);
  const selectTrial = useCallback((id: string) => {
    setLiveSeries(null);
    setState((prev) => (prev.selectedId === id ? prev : { ...prev, selectedId: id }));
  }, []);
  const resetTrial = useCallback((id: string) => {
    setLiveSeries(null);
    setState((prev) => ({
      ...prev,
      trials: prev.trials.map((t) =>
        t.id === id ? { ...t, output: null, finalTransient: null } : t,
      ),
    }));
  }, []);
  const updateInput = useCallback((id: string, input: SimInput) => {
    setState((prev) => ({
      ...prev,
      trials: prev.trials.map((t) => (t.id === id ? { ...t, input } : t)),
    }));
  }, []);
  const completeTrial = useCallback(
    (id: string, output: SimOutput, finalTransient: SimTransient) => {
      // Clear live series — output.avgDistanceSeries (now committed) takes over as the source
      // the Data panel reads from.
      setLiveSeries(null);
      setState((prev) => ({
        ...prev,
        trials: prev.trials.map((t) => (t.id === id ? { ...t, output, finalTransient } : t)),
      }));
    },
    [],
  );
  const handleProgress = useCallback((series: readonly number[]) => {
    // The runner emits a fresh array per sample; copy defensively to keep the state value
    // immutable from this side of the callback boundary.
    setLiveSeries([...series]);
  }, []);

  return (
    <SimulationFrame
      simTitle="Random Walk"
      tagline="An interactive starter simulation"
      infoModalContent={
        <p>
          This is the Mass Sims starter simulation — a small random-walk model that serves as the
          template for new sims. Adjust the parameters, run trials, and observe how the population
          disperses over time.
        </p>
      }
    >
      <SimulationFrame.Trials>
        {trials.map((trial, i) => (
          <TrialCard
            key={trial.id}
            index={i}
            selected={trial.id === selectedId}
            onSelect={() => selectTrial(trial.id)}
            onReset={() => resetTrial(trial.id)}
            resetDisabled={trial.output === null}
          >
            {trial.output ? (
              <>
                <span>avg {trial.output.avgDistance.toFixed(1)}</span>
                <span>σ {trial.output.stdDevDistance.toFixed(1)}</span>
              </>
            ) : null}
          </TrialCard>
        ))}
        {trials.length < TRIAL_LIMIT ? (
          <button
            type="button"
            className="new-trial-card"
            aria-label="New trial"
            onClick={addTrial}
          >
            <span className="new-trial-icon" aria-hidden="true">
              +
            </span>
            New
          </button>
        ) : null}
      </SimulationFrame.Trials>

      <SimulationFrame.Simulation instruction="Choose parameters, then press Play">
        <SimulationView
          key={`${selected.id}:${selected.output ? "done" : "empty"}`}
          trial={selected}
          trialLabel={selectedLetter}
          onInputChange={(input) => updateInput(selected.id, input)}
          onComplete={(output, finalTransient) =>
            completeTrial(selected.id, output, finalTransient)
          }
          onReset={() => resetTrial(selected.id)}
          onProgress={handleProgress}
        />
      </SimulationFrame.Simulation>

      <SimulationFrame.Data>
        <DataPanel
          trials={trials}
          selectedIndex={trials.indexOf(selected)}
          liveSeries={liveSeries}
        />
      </SimulationFrame.Data>
    </SimulationFrame>
  );
}
