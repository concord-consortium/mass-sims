import { Button } from "@concord-consortium/mass-sims-shared";
import clsx from "clsx";
import { BATH_STEPS, bathMeltStep, lastSeen } from "../model/observe";
import { LUMP_ASSIGNMENT, type LumpId, type SubstanceId } from "../model/substances";
import type { TestId } from "../model/tests";
import type { Trial } from "../model/trial";
import { TestPicker } from "./test-picker";
import { RUN_MS, TestTimer, useRunProgress } from "./test-timer";

import "./test-lab.scss";

export interface TestLabProps {
  trial: Trial;
  /** The lump on the bench, spent or not, or null when the tray has not been used yet. */
  selectedLump: LumpId | null;
  test: TestId;
  running: boolean;
  /** Changes whenever the meter should start over — a new run, or a reset of the lump's test. */
  timerEpoch: number;
  /** The most recent observation's caption, cleared when a different lump comes to the bench. */
  message: string | null;
  onTestChange: (test: TestId) => void;
  onExamine: () => void;
  onRun: () => void;
  /** Undoes the test on the lump that is on the bench, giving it its material back. */
  onResetTest: () => void;
}

/**
 * The Test Lab: the bench, with the test picker down its right side. One lump at a time stands
 * on the bench with the apparatus for the chosen test, and a caption below it for whatever was
 * last observed.
 *
 * Look, feel, smell sits on the counter where the lump rests, and stays there when the lump
 * goes to the apparatus; it is free, so it is never part of the test area. Run and Reset Test share the bench's bottom-right corner: once a lump's test
 * has run, Reset replaces Run, because the lump has nothing left to test.
 *
 * A spent lump stays here until a different one is picked, which is the window in which it can
 * still be examined — the only route to the rancid smell after the lamp.
 */
export function TestLab({
  trial,
  selectedLump,
  test,
  running,
  timerEpoch,
  message,
  onTestChange,
  onExamine,
  onRun,
  onResetTest,
}: TestLabProps) {
  const record = selectedLump ? trial.lumps[selectedLump] : null;
  const substance = selectedLump ? LUMP_ASSIGNMENT[selectedLump] : null;
  const resting = substance && record ? lastSeen(substance, record) : "unknown";
  const spent = record?.result != null;

  const timerKey = `${timerEpoch}:${test}`;

  return (
    <div className="test-lab">
      <div className="lab-title">Test Lab</div>
      <div className="lab-body">
        <div className="bench-column">
          <div className={clsx("bench", { running })}>
            {selectedLump === null ? (
              <p className="bench-prompt">Pick a sample from the tray to put it on the bench.</p>
            ) : (
              <>
                <div className={clsx("apparatus", `tool-${test}`)} aria-hidden="true">
                  {test === "bath" ? <BathDial key={timerKey} running={running} /> : null}
                  <span className="tool-label">{TOOL_LABELS[test]}</span>
                </div>
                {/* Staged means "at the apparatus": the lump travels there on Run and stays once
                  its test is spent, so the bench still reads as a record afterwards. */}
                <div className={clsx("bench-lump", { staged: running || spent })}>
                  <span
                    className={clsx("bench-blob", `visual-${resting}`)}
                    style={meltDelay(substance, record?.result?.test)}
                    aria-hidden="true"
                  />
                  <span className="bench-letter">Sample {selectedLump}</span>
                </div>
                <Button
                  className="examine-button"
                  onPress={onExamine}
                  // Examining mid-run would describe the result before the test had finished.
                  isDisabled={running}
                  action="lump_examined"
                >
                  <span aria-hidden="true">🔍</span> Look, feel, smell
                </Button>
              </>
            )}
            <TestTimer
              // Replaced rather than rewound: a new run, or a change of test, gets a fresh bar.
              key={timerKey}
              test={test}
              running={running}
            />
            {spent ? (
              <Button className="bench-action" onPress={onResetTest} isDisabled={running}>
                Reset Test
              </Button>
            ) : (
              <Button
                className="bench-action run-button"
                onPress={onRun}
                isDisabled={selectedLump === null || running}
              >
                Run test
              </Button>
            )}
          </div>
          {/* Under the bench rather than on it: a three-step bath result would cover the
            equipment. */}
          <p className="bench-message">{message}</p>
        </div>
        <TestPicker test={test} running={running} onTestChange={onTestChange} />
      </div>
    </div>
  );
}

/** What the drawn apparatus is called, for the student and for the placeholder art's caption. */
const TOOL_LABELS: Record<TestId, string> = {
  water: "beaker of water",
  vinegar: "tube of vinegar",
  bath: "dry dish in a warm bath",
  lamp: "UV lamp, two weeks",
  handle: "",
  waft: "",
};

/**
 * The bath's temperatures as written on the instrument, the current one lit as the run steps
 * through them. Keyed with the timer, so a new run or a reset starts it from cold.
 */
function BathDial({ running }: { running: boolean }) {
  const progress = useRunProgress(running);
  const current =
    progress === 0
      ? null
      : Math.min(BATH_STEPS.length - 1, Math.floor(progress * BATH_STEPS.length));
  return (
    <span className="bath-dial">
      {BATH_STEPS.map((temp, i) => (
        <span key={temp} className={clsx({ current: i === current })}>
          {temp} °C
        </span>
      ))}
    </span>
  );
}

/** The lump travels for this long before its outcome starts to play. */
const TRAVEL_MS = 800;

/** A bath melt waits for the step it happens at, so the lump runs as that temperature lights. */
function meltDelay(
  substance: SubstanceId | null,
  test: TestId | undefined,
): { animationDelay: string } | undefined {
  if (!substance || test !== "bath") return undefined;
  const step = bathMeltStep(substance);
  if (step === null) return undefined;
  return { animationDelay: `${TRAVEL_MS + (step * RUN_MS) / BATH_STEPS.length}ms` };
}
