import { useFrameLoop } from "@concord-consortium/mass-sims-shared";
import { useState } from "react";
import { formatSimTime, simDurationSeconds } from "../model/sim-time";
import type { SettingId, TestId } from "../model/tests";

import "./test-timer.scss";

/** Wall-clock time a test takes to run, whatever span of sim time it stands for. */
export const RUN_MS = 7000;

export interface TestTimerProps {
  test: TestId;
  setting: SettingId | null;
}

/**
 * The bar that counts a test out. It always takes seven real seconds to fill, while the number
 * beside it counts whatever span of sim time the test stands for — two minutes in the vinegar,
 * two weeks under the lamp. Showing both is what keeps the compression honest rather than
 * hidden: the student can see that the clock on screen is not the clock in the story.
 *
 * It starts from zero on mount and has no reset of its own; the bench gives it a `key` per run,
 * so a repeat of the same test gets a fresh timer rather than a stale one told to rewind.
 */
export function TestTimer({ test, setting }: TestTimerProps) {
  const total = simDurationSeconds(test, setting);
  const [elapsedMs, setElapsedMs] = useState(0);

  useFrameLoop((deltaMs) => {
    setElapsedMs((ms) => Math.min(RUN_MS, ms + deltaMs));
  }, elapsedMs < RUN_MS);

  const progress = elapsedMs / RUN_MS;

  return (
    <div className="test-timer">
      <div
        className="timer-track"
        // The bar is the visible half of a progress readout; the label below carries the same
        // information as text, and these attributes carry it to a screen reader.
        role="progressbar"
        aria-label="Test progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={Math.round(progress * total)}
        aria-valuetext={`${formatSimTime(progress * total)} of ${formatSimTime(total)}`}
      >
        <div className="timer-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="timer-label">
        {formatSimTime(progress * total)} / {formatSimTime(total)}
      </div>
    </div>
  );
}
