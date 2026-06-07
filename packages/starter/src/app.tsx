import { SimulationFrame, TrialCard, useReloadWarning } from "@concord-consortium/mass-sims-shared";
import { useCallback, useState } from "react";
import { DataPanel } from "./components/data-panel";
import { SimulationView } from "./components/simulation-view";
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
 */
export function App() {
  const [trials, setTrials] = useState<RecordedTrial[]>(() => [makeEmptyTrial()]);
  const [selectedId, setSelectedId] = useState(() => trials[0].id);

  const selected = trials.find((t) => t.id === selectedId) ?? trials[0];
  // Selected trial's letter (0→A, 1→B, …).
  const selectedLetter = String.fromCharCode(65 + Math.max(0, trials.indexOf(selected)));

  // Warn before unload only once a trial has been run: an empty trial A always exists, so guarding
  // on trial count would warn from the start.
  useReloadWarning(trials.some((t) => t.output !== null));

  const addTrial = useCallback(() => {
    if (trials.length >= TRIAL_LIMIT) return;
    const trial = makeEmptyTrial();
    setTrials((prev) => (prev.length >= TRIAL_LIMIT ? prev : [...prev, trial]));
    setSelectedId(trial.id);
  }, [trials.length]);

  const resetTrial = useCallback((id: string) => {
    setTrials((prev) =>
      prev.map((t) => (t.id === id ? { ...t, output: null, finalTransient: null } : t)),
    );
  }, []);

  const updateInput = useCallback((id: string, input: SimInput) => {
    setTrials((prev) => prev.map((t) => (t.id === id ? { ...t, input } : t)));
  }, []);

  const completeTrial = useCallback(
    (id: string, output: SimOutput, finalTransient: SimTransient) => {
      setTrials((prev) => prev.map((t) => (t.id === id ? { ...t, output, finalTransient } : t)));
    },
    [],
  );

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
            onSelect={() => setSelectedId(trial.id)}
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
        />
      </SimulationFrame.Simulation>

      <SimulationFrame.Data>
        <DataPanel trials={trials} selectedIndex={trials.indexOf(selected)} />
      </SimulationFrame.Data>
    </SimulationFrame>
  );
}
