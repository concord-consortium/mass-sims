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
  onResetTrial: () => void;
}

/**
 * The bench's control row. Choosing a test swaps the apparatus on the bench above; its dial
 * appears only for the two tests that have one, and is disabled rather than removed so the row
 * keeps its shape.
 *
 * Observe and Waft sit beside Run deliberately: all three act on the lump on the bench, but only
 * Run uses it up, so they stay enabled when Run no longer is.
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
  onResetTrial,
}: LabControlsProps) {
  const settings = TESTS[test].settings;

  return (
    <div className="lab-controls">
      <div className="control-row tests">
        <fieldset className="test-buttons">
          <legend className="control-label">Test</legend>
          {CONSUMING_TESTS.map((id) => (
            <button
              key={id}
              type="button"
              className={clsx("test-button", { chosen: id === test })}
              aria-pressed={id === test}
              onClick={() => onTestChange(id)}
              disabled={running}
            >
              {TESTS[id].label}
            </button>
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
          isDisabled={!hasLump || running}
          action="lump_observed"
        >
          <span aria-hidden="true">🔍</span> Observe
        </Button>
        <Button
          className="waft-button"
          onPress={onWaft}
          isDisabled={!hasLump || running}
          action="lump_wafted"
        >
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
        <Button className="reset-button" onPress={onResetTrial} isDisabled={running}>
          Reset Trial
        </Button>
      </div>
    </div>
  );
}
