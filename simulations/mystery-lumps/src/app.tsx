import { setInteractiveState, useInitMessage } from "@concord-consortium/lara-interactive-api";
import {
  SimulationFrame,
  TrialCard,
  useLogEvent,
  useReloadWarning,
} from "@concord-consortium/mass-sims-shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { EvidencePanel } from "./components/evidence-panel";
import { LumpRow } from "./components/lump-row";
import { TestSettings } from "./components/test-settings";
import { TrialCardBody } from "./components/trial-card-body";
import type { SavedState } from "./model/saved-state";
import type { LumpId } from "./model/substances";
import type { SettingId, TestId } from "./model/tests";
import {
  applyTest,
  clearTrial,
  makeEmptyTrial,
  markHandled,
  markWafted,
  type Trial,
} from "./model/trial";

import "./app.scss";

const TRIAL_LIMIT = 10; // Matches TrialCard's A–J letter cap.
/** Every test animates for the same time, whatever span it stands for. */
const RUN_MS = 4000;

export function App() {
  const [{ trials, selectedId }, setState] = useState(() => {
    const first = makeEmptyTrial();
    return { trials: [first] as Trial[], selectedId: first.id };
  });
  // The lump currently animating, or null. Deliberately not persisted: a student who reloads
  // mid-test comes back to the finished result, not to a frozen animation.
  const [runningLump, setRunningLump] = useState<LumpId | null>(null);
  const runTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logEvent = useLogEvent();

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

  // Clear a pending animation on unmount so a late timer can't set state on a dead component.
  useEffect(
    () => () => {
      if (runTimer.current) clearTimeout(runTimer.current);
    },
    [],
  );

  const selected = trials.find((t) => t.id === selectedId) ?? trials[0];
  const anythingObserved = trials.some((t) =>
    Object.values(t.lumps).some((l) => l.result !== null || l.handled || l.wafted),
  );
  useReloadWarning(!isEmbedded && anythingObserved);

  const updateTrial = useCallback((id: string, change: (trial: Trial) => Trial) => {
    setState((prev) => ({
      ...prev,
      trials: prev.trials.map((t) => (t.id === id ? change(t) : t)),
    }));
  }, []);

  const addTrial = useCallback(() => {
    const trial = makeEmptyTrial();
    logEvent("trial_started", {});
    setState((prev) =>
      prev.trials.length >= TRIAL_LIMIT
        ? prev
        : { trials: [...prev.trials, trial], selectedId: trial.id },
    );
  }, [logEvent]);

  const selectTrial = useCallback((id: string) => {
    setState((prev) => (prev.selectedId === id ? prev : { ...prev, selectedId: id }));
  }, []);

  const resetTrial = useCallback(
    (id: string) => {
      logEvent("trial_reset", {});
      updateTrial(id, clearTrial);
    },
    [logEvent, updateTrial],
  );

  const handleLump = useCallback(
    (lump: LumpId) => {
      logEvent("lump_handled", { lump });
      updateTrial(selected.id, (t) => markHandled(t, lump));
    },
    [logEvent, selected.id, updateTrial],
  );

  const waftLump = useCallback(
    (lump: LumpId) => {
      logEvent("lump_wafted", { lump });
      updateTrial(selected.id, (t) => markWafted(t, lump));
    },
    [logEvent, selected.id, updateTrial],
  );

  // The result is committed up front and the animation is only a delay before the student may
  // act again, so a reload mid-run loses nothing.
  const runTest = useCallback(
    (lump: LumpId, test: TestId, setting: SettingId | null) => {
      logEvent("test_run", { lump, test, setting: String(setting) });
      updateTrial(selected.id, (t) => applyTest(t, lump, test, setting));
      setRunningLump(lump);
      if (runTimer.current) clearTimeout(runTimer.current);
      runTimer.current = setTimeout(() => setRunningLump(null), RUN_MS);
    },
    [logEvent, selected.id, updateTrial],
  );

  return (
    <SimulationFrame
      simTitle="Mystery Lumps"
      tagline="Five white lumps washed up on a beach. What are they?"
      infoModalContent={
        <p>
          Five lumps were collected from a beach. Each one has enough material for a single test, so
          choose carefully — but you can look at them and smell them as often as you like. Record
          what you observe; the simulation will not tell you what anything is.
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
          >
            <TrialCardBody trial={trial} />
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

      <SimulationFrame.Simulation instruction="Each lump has enough for one test — handling is free">
        <TestSettings
          trial={selected}
          running={runningLump !== null}
          onRun={runTest}
          onResetTrial={() => resetTrial(selected.id)}
        />
        <LumpRow
          trial={selected}
          runningLump={runningLump}
          onHandle={handleLump}
          onWaft={waftLump}
        />
      </SimulationFrame.Simulation>

      <SimulationFrame.Data>
        <EvidencePanel trial={selected} />
      </SimulationFrame.Data>
    </SimulationFrame>
  );
}
