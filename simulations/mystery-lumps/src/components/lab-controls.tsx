import { Button, Select } from "@concord-consortium/mass-sims-shared";
import clsx from "clsx";
import { CONSUMING_TESTS, type SettingId, TESTS, type TestId } from "../model/tests";

import "./lab-controls.scss";

export interface LabControlsProps {
  test: TestId;
  setting: SettingId | null;
  /** False before a lump has been picked, which disables everything that acts on one. */
  hasLump: boolean;
  /** True once the lump on the bench has spent its one test. */
  spent: boolean;
  running: boolean;
  onTestChange: (test: TestId) => void;
  onSettingChange: (setting: SettingId) => void;
  onObserve: () => void;
  onWaft: () => void;
  onRun: () => void;
  /** Undoes the test on the lump that is on the bench, returning it to its slot. */
  onResetTest: () => void;
}

/**
 * The bench's control row. Choosing a test swaps the apparatus on the bench above; its dial
 * appears only for the two tests that have one, and is disabled rather than removed so the row
 * keeps its shape.
 *
 * Observe and Waft sit beside Run deliberately: all three act on the lump on the bench, but only
 * Run uses it up. They are available whenever there is a lump there at all — before a test,
 * during one, and after — because looking at something costs nothing and what you see changes
 * as the lump does.
 *
 * Reset Test is the narrow undo — it gives this one lump its material back. Clearing a whole
 * trial is the trial card's job, which is the only place that reaches the other four lumps.
 */
export function LabControls({
  test,
  setting,
  hasLump,
  spent,
  running,
  onTestChange,
  onSettingChange,
  onObserve,
  onWaft,
  onRun,
  onResetTest,
}: LabControlsProps) {
  const settings = TESTS[test].settings;

  return (
    <div className="lab-controls">
      <div className="control-row tests">
        <fieldset className="test-buttons">
          <legend className="control-label">Test</legend>
          {CONSUMING_TESTS.map((id) => (
            <Button
              key={id}
              className={clsx("test-button", { chosen: id === test })}
              aria-pressed={id === test}
              onPress={() => onTestChange(id)}
              isDisabled={running}
            >
              {TESTS[id].label}
            </Button>
          ))}
        </fieldset>
        <Select
          className="setting-select"
          label="Setting"
          options={settings.map((s) => ({ id: String(s.id), label: s.label }))}
          selectedKey={setting === null ? null : String(setting)}
          onSelectionChange={(id) => onSettingChange(id as SettingId)}
          isDisabled={settings.length === 0 || running}
          placeholder="—"
          action="setting_selected"
        />
      </div>

      <div className="control-row actions">
        <Button
          className="observe-button"
          onPress={onObserve}
          isDisabled={!hasLump}
          action="lump_observed"
        >
          <span aria-hidden="true">🔍</span> Observe
        </Button>
        <Button className="waft-button" onPress={onWaft} isDisabled={!hasLump} action="lump_wafted">
          <span aria-hidden="true">〜</span> Waft
        </Button>
        <Button
          className="run-button"
          onPress={onRun}
          // Spent is its own reason, separate from running: the lump is still on the bench and
          // the free actions still work on it, but there is no material left to test.
          isDisabled={!hasLump || spent || running}
        >
          Run test
        </Button>
        <Button className="reset-button" onPress={onResetTest} isDisabled={!spent || running}>
          Reset Test
        </Button>
      </div>
    </div>
  );
}
