import clsx from "clsx";
import { BATH_STEPS, bathMeltStep, lastSeen } from "../model/observe";
import { LUMP_ASSIGNMENT, type LumpId, type SubstanceId } from "../model/substances";
import { type SettingId, TESTS, type TestId } from "../model/tests";
import type { Trial } from "../model/trial";
import { RUN_MS, TestTimer, useRunProgress } from "./test-timer";

import "./test-lab.scss";

export interface TestLabProps {
  trial: Trial;
  /** The lump on the bench, spent or not, or null when the tray has not been used yet. */
  selectedLump: LumpId | null;
  test: TestId;
  setting: SettingId | null;
  running: boolean;
  /** Changes whenever the meter should start over — a new run, or a reset of the lump's test. */
  timerEpoch: number;
  /** The most recent observation's caption, cleared when a different lump comes to the bench. */
  message: string | null;
}

/**
 * The bench. One lump at a time, with the apparatus for the currently chosen test standing on
 * it, and a caption for whatever was last observed.
 *
 * A spent lump stays here until a different one is picked, which is the window in which it can
 * still be examined — the only route to the rancid smell after the lamp.
 */
export function TestLab({
  trial,
  selectedLump,
  test,
  setting,
  running,
  timerEpoch,
  message,
}: TestLabProps) {
  const record = selectedLump ? trial.lumps[selectedLump] : null;
  const substance = selectedLump ? LUMP_ASSIGNMENT[selectedLump] : null;
  const resting = substance && record ? lastSeen(substance, record) : "unknown";

  const timerKey = `${timerEpoch}:${test}:${setting}`;

  return (
    <div className="test-lab">
      <div className="lab-title">Test Lab</div>
      <div className={clsx("bench", { running })}>
        {selectedLump === null ? (
          <p className="bench-prompt">Pick a sample from the tray to put it on the bench.</p>
        ) : (
          <>
            <div className={clsx("apparatus", `tool-${test}`)} aria-hidden="true">
              {test === "bath" ? <BathDial key={timerKey} running={running} /> : null}
              <span className="tool-label">{toolLabel(test, setting)}</span>
            </div>
            {/* Staged means "at the apparatus": the lump travels there on Run and stays once
                its test is spent, so the bench still reads as a record afterwards. */}
            <div className={clsx("bench-lump", { staged: running || record?.result != null })}>
              <span
                className={clsx("bench-blob", `visual-${resting}`)}
                style={meltDelay(substance, record?.result?.test)}
                aria-hidden="true"
              />
              <span className="bench-letter">Sample {selectedLump}</span>
            </div>
          </>
        )}
        <TestTimer
          // Replaced rather than rewound: a new run, or a change of test, gets a fresh bar.
          key={timerKey}
          test={test}
          setting={setting}
          running={running}
        />
        {message ? <p className="bench-message">{message}</p> : null}
      </div>
    </div>
  );
}

/** What the drawn apparatus is called, for the student and for the placeholder art's caption. */
const TOOL_LABELS: Record<TestId, string> = {
  water: "beaker of water",
  vinegar: "tube of vinegar",
  bath: "dry dish in a warm bath",
  lamp: "UV lamp",
  handle: "",
  waft: "",
};

/** The apparatus names its dial too, so the bench says what it is set to before Run is pressed. */
function toolLabel(test: TestId, setting: SettingId | null): string {
  const base = TOOL_LABELS[test];
  if (setting === null) return base;
  const option = TESTS[test].settings.find((s) => String(s.id) === String(setting));
  return option ? `${base}, ${option.label.toLowerCase()}` : base;
}

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
