import { setInteractiveState, useInitMessage } from "@concord-consortium/lara-interactive-api";
import {
  SimulationFrame,
  TrialCard,
  useReloadWarning,
  useSimulationRunner,
} from "@concord-consortium/mass-sims-shared";
import { useCallback, useEffect, useState } from "react";
import { DataPanel } from "./components/data-panel";
import { SimulationView } from "./components/simulation-view";
import { END_YEAR, finalizeTrial, START_YEAR, YEARS_PER_FRAME } from "./model/collapse";
import type { SavedState } from "./model/saved-state";
import type { RecordedTrial, SimInput } from "./model/types";

import "./app.scss";

const TRIAL_LIMIT = 10; // Matches TrialCard's A–J letter cap.
const DEFAULT_SETTINGS: SimInput = { wetness: "wet", wind: "calm", soil: "limestone" };
const RAINSTORM_MS = 10_000; // Each rainstorm runs for 10 seconds, then stops on its own.

function makeTrialId(): string {
  return Math.random().toString(36).slice(2, 10);
}
function makeEmptyTrial(input: SimInput = DEFAULT_SETTINGS): RecordedTrial {
  return { id: makeTrialId(), input: { ...input }, output: null, finalTransient: null };
}

const SETTING_LABELS = {
  wetness: { wet: "Wet", dry: "Dry" },
  wind: { windy: "Windy", calm: "Calm" },
  soil: { limestone: "Limestone", bedrock: "Bedrock" },
} as const;

/**
 * Collapse — mock sim of the 2014 Corvette Museum karst sinkhole. App owns the trial list, the
 * shared timeline `year`, and the play loop. Lifting `year` here (rather than into SimulationView)
 * lets the Data panel's erosion meters and the cross-section update live as the years advance.
 */
export function App() {
  const [{ trials, selectedId }, setState] = useState(() => {
    const first = makeEmptyTrial();
    return { trials: [first], selectedId: first.id };
  });
  const [year, setYear] = useState(START_YEAR);
  const [rainstormActive, setRainstormActive] = useState(false);

  // AP saved-state sync: restore on init, push on change (standalone-safe — see infra-plan §3).
  const initMsg = useInitMessage<SavedState>();
  const isEmbedded = initMsg !== null;
  useEffect(() => {
    if (initMsg && "interactiveState" in initMsg && initMsg.interactiveState) {
      setState(initMsg.interactiveState);
    }
  }, [initMsg]);
  useEffect(() => {
    setInteractiveState<SavedState>({ trials, selectedId });
  }, [trials, selectedId]);

  const selected = trials.find((t) => t.id === selectedId) ?? trials[0];
  const selectedLetter = String.fromCharCode(65 + Math.max(0, trials.indexOf(selected)));
  // Toggles lock once the timeline advances or the trial has a recorded outcome; Reset re-opens.
  const inputsLocked = year > START_YEAR || selected.output !== null;

  useReloadWarning(!isEmbedded && trials.some((t) => t.output !== null));

  // Play loop: advance the year a couple of years per frame, capped at END_YEAR.
  const onStep = useCallback(() => {
    setYear((y) => Math.min(END_YEAR, y + YEARS_PER_FRAME));
  }, []);
  const { isPlaying, play, pause } = useSimulationRunner({ onStep });

  // Stop the runner at the end of the timeline.
  useEffect(() => {
    if (year >= END_YEAR && isPlaying) pause();
  }, [year, isPlaying, pause]);

  // Record the trial's outcome once the timeline reaches the final year.
  useEffect(() => {
    if (year >= END_YEAR && selected.output === null) {
      const output = finalizeTrial(selected.input);
      setState((prev) => ({
        ...prev,
        trials: prev.trials.map((t) =>
          t.id === selected.id ? { ...t, output, finalTransient: { year: END_YEAR } } : t,
        ),
      }));
    }
  }, [year, selected]);

  const changeInput = useCallback((patch: Partial<SimInput>) => {
    setState((prev) => ({
      ...prev,
      trials: prev.trials.map((t) =>
        t.id === prev.selectedId ? { ...t, input: { ...t.input, ...patch } } : t,
      ),
    }));
  }, []);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      setRainstormActive(false);
      play();
    }
  }, [isPlaying, play, pause]);

  const scrubYear = useCallback(
    (y: number) => {
      pause();
      setYear(y);
    },
    [pause],
  );

  // A rainstorm pauses the timeline and runs for a fixed 10s, then stops itself. Starting it
  // while one is already running is a no-op (the button is disabled meanwhile).
  const startRainstorm = useCallback(() => {
    pause();
    setRainstormActive(true);
  }, [pause]);

  // Auto-stop the rainstorm after RAINSTORM_MS. Any state change that clears rainstormActive
  // (reset / select / new trial) also cancels the timer via this effect's cleanup.
  useEffect(() => {
    if (!rainstormActive) return;
    const id = setTimeout(() => setRainstormActive(false), RAINSTORM_MS);
    return () => clearTimeout(id);
  }, [rainstormActive]);

  const resetSelected = useCallback(() => {
    pause();
    setRainstormActive(false);
    setYear(START_YEAR);
    setState((prev) => ({
      ...prev,
      trials: prev.trials.map((t) =>
        t.id === prev.selectedId ? { ...t, output: null, finalTransient: null } : t,
      ),
    }));
  }, [pause]);

  const selectTrial = useCallback(
    (id: string) => {
      pause();
      setRainstormActive(false);
      const t = trials.find((x) => x.id === id);
      // Show recorded trials at their outcome year; empty trials at the start.
      setYear(t?.output ? END_YEAR : START_YEAR);
      setState((prev) => (prev.selectedId === id ? prev : { ...prev, selectedId: id }));
    },
    [pause, trials],
  );

  const resetTrial = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        trials: prev.trials.map((t) =>
          t.id === id ? { ...t, output: null, finalTransient: null } : t,
        ),
      }));
      if (id === selectedId) {
        pause();
        setRainstormActive(false);
        setYear(START_YEAR);
      }
    },
    [pause, selectedId],
  );

  const addTrial = useCallback(() => {
    pause();
    setRainstormActive(false);
    setYear(START_YEAR);
    setState((prev) => {
      if (prev.trials.length >= TRIAL_LIMIT) return prev;
      // Seed the new trial from the current selection's settings for quick iteration.
      const base = prev.trials.find((t) => t.id === prev.selectedId)?.input ?? DEFAULT_SETTINGS;
      const trial = makeEmptyTrial(base);
      return { trials: [...prev.trials, trial], selectedId: trial.id };
    });
  }, [pause]);

  return (
    <SimulationFrame
      simTitle="Collapse"
      tagline="What made the ground give way beneath the Corvette Museum?"
      infoModalContent={
        <p>
          A mock simulation of the karst sinkhole that collapsed part of the National Corvette
          Museum in Bowling Green, Kentucky in 2014, above the Mammoth Cave system. Choose a climate
          and soil, then watch ~2000 years pass: in a wet climate over soluble limestone, rainwater
          slowly dissolves the cave roof until it fails.
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
            <span>{SETTING_LABELS.wetness[trial.input.wetness]}</span>
            <span>{SETTING_LABELS.wind[trial.input.wind]}</span>
            <span>{SETTING_LABELS.soil[trial.input.soil]}</span>
            {trial.output ? (
              <span className={trial.output.collapsed ? "trial-collapsed" : "trial-intact"}>
                {trial.output.collapsed ? "Collapsed" : "Intact"}
              </span>
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

      <SimulationFrame.Simulation instruction="Set climate & soil, then press Play (or drag the Year slider)">
        <SimulationView
          input={selected.input}
          year={year}
          isPlaying={isPlaying}
          rainstormActive={rainstormActive}
          inputsLocked={inputsLocked}
          trialLabel={selectedLetter}
          onChangeInput={changeInput}
          onPlayPause={handlePlayPause}
          onScrubYear={scrubYear}
          onStartRainstorm={startRainstorm}
          onReset={resetSelected}
        />
      </SimulationFrame.Simulation>

      <SimulationFrame.Data>
        <DataPanel input={selected.input} year={year} />
      </SimulationFrame.Data>
    </SimulationFrame>
  );
}
