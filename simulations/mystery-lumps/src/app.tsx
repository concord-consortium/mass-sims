import { setInteractiveState, useInitMessage } from "@concord-consortium/lara-interactive-api";
import {
  SimulationFrame,
  TrialCard,
  useLogEvent,
  useReloadWarning,
} from "@concord-consortium/mass-sims-shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { EvidencePanel } from "./components/evidence-panel";
import { LabControls } from "./components/lab-controls";
import { LumpTray } from "./components/lump-tray";
import { TestLab } from "./components/test-lab";
import { TrialCardBody } from "./components/trial-card-body";
import { observe } from "./model/observe";
import type { SavedState } from "./model/saved-state";
import type { LumpId } from "./model/substances";
import { LUMP_ASSIGNMENT } from "./model/substances";
import { CONSUMING_TESTS, type SettingId, TESTS, type TestId } from "./model/tests";
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
  // The lump on the bench. It stays there after its test is spent — that window is the only
  // time Observe and Waft can still reach it, which is how the rancid smell is found.
  const [selectedLump, setSelectedLump] = useState<LumpId | null>(null);
  const [test, setTest] = useState<TestId>(CONSUMING_TESTS[0]);
  const [setting, setSetting] = useState<SettingId | null>(null);
  // The bench caption. Transient and never persisted, so a reload shows the Data column's
  // record rather than a stale one-off line.
  const [message, setMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
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

  // The dial belongs to the test, so changing test resets it to that test's first value (or to
  // null for the two tests without one). Run then never meets a test whose setting is missing.
  useEffect(() => {
    const settings = TESTS[test].settings;
    setSetting(settings.length > 0 ? settings[0].id : null);
  }, [test]);

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
    setSelectedLump(null);
    setMessage(null);
    setState((prev) =>
      prev.trials.length >= TRIAL_LIMIT
        ? prev
        : { trials: [...prev.trials, trial], selectedId: trial.id },
    );
  }, [logEvent]);

  const selectTrial = useCallback((id: string) => {
    // A lump belongs to its trial, so the bench empties when the trial changes under it.
    setSelectedLump(null);
    setMessage(null);
    setState((prev) => (prev.selectedId === id ? prev : { ...prev, selectedId: id }));
  }, []);

  const resetTrial = useCallback(
    (id: string) => {
      logEvent("trial_reset", {});
      updateTrial(id, clearTrial);
      setSelectedLump(null);
      setMessage(null);
    },
    [logEvent, updateTrial],
  );

  // Picking a different lump clears the bench caption: it described the lump that just left,
  // and its record lives in the Data column now.
  const pickLump = useCallback((lump: LumpId) => {
    setSelectedLump(lump);
    setMessage(null);
  }, []);

  const observeLump = useCallback(() => {
    if (!selectedLump) return;
    logEvent("lump_handled", { lump: selectedLump });
    updateTrial(selected.id, (t) => markHandled(t, selectedLump));
    setMessage(observe(LUMP_ASSIGNMENT[selectedLump], "handle", null).caption);
  }, [logEvent, selected.id, selectedLump, updateTrial]);

  const waftLump = useCallback(() => {
    if (!selectedLump) return;
    logEvent("lump_wafted", { lump: selectedLump });
    updateTrial(selected.id, (t) => markWafted(t, selectedLump));
    // Wafting reads the lump's spent test, since only UV-degraded palm oil smells of anything.
    const prior = selected.lumps[selectedLump].result;
    setMessage(observe(LUMP_ASSIGNMENT[selectedLump], "waft", null, prior).caption);
  }, [logEvent, selected, selectedLump, updateTrial]);

  // The result is committed up front and the animation is only a delay before the student may
  // act again, so a reload mid-run loses nothing.
  const runTest = useCallback(() => {
    if (!selectedLump) return;
    logEvent("test_run", { lump: selectedLump, test, setting: String(setting) });
    updateTrial(selected.id, (t) => applyTest(t, selectedLump, test, setting));
    const result = observe(LUMP_ASSIGNMENT[selectedLump], test, setting);
    setMessage(`${result.caption} (${result.elapsed})`);
    setRunning(true);
    if (runTimer.current) clearTimeout(runTimer.current);
    runTimer.current = setTimeout(() => setRunning(false), RUN_MS);
  }, [logEvent, selected.id, selectedLump, setting, test, updateTrial]);

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

      <SimulationFrame.Simulation instruction="Each lump has enough for one test — looking is free">
        <LumpTray trial={selected} selectedLump={selectedLump} onSelect={pickLump} />
        <TestLab
          trial={selected}
          selectedLump={selectedLump}
          test={test}
          setting={setting}
          running={running}
          message={message}
        />
        <LabControls
          test={test}
          setting={setting}
          hasLump={selectedLump !== null}
          spent={selectedLump !== null && selected.lumps[selectedLump].result !== null}
          running={running}
          onTestChange={setTest}
          onSettingChange={setSetting}
          onObserve={observeLump}
          onWaft={waftLump}
          onRun={runTest}
          onResetTrial={() => resetTrial(selected.id)}
        />
      </SimulationFrame.Simulation>

      <SimulationFrame.Data>
        <EvidencePanel trial={selected} />
      </SimulationFrame.Data>
    </SimulationFrame>
  );
}
