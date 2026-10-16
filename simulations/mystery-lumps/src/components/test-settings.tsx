import { Button, Select } from "@concord-consortium/mass-sims-shared";
import { useEffect, useState } from "react";
import type { LumpId } from "../model/substances";
import { CONSUMING_TESTS, type SettingId, TESTS, type TestId } from "../model/tests";
import { type Trial, untestedLumps } from "../model/trial";

import "./test-settings.scss";

export interface TestSettingsProps {
  trial: Trial;
  running: boolean;
  onRun: (lump: LumpId, test: TestId, setting: SettingId | null) => void;
  onResetTrial: () => void;
}

/**
 * Lump, test and the test's dial, chosen the way Nor'easter chooses variables. Only the four
 * destructive tests appear here; handling and wafting live on the lumps themselves.
 */
export function TestSettings({ trial, running, onRun, onResetTrial }: TestSettingsProps) {
  const available = untestedLumps(trial);
  const [lump, setLump] = useState<LumpId | null>(available[0] ?? null);
  const [test, setTest] = useState<TestId>(CONSUMING_TESTS[0]);
  const [setting, setSetting] = useState<SettingId | null>(null);

  // A spent lump leaves the dropdown, so the selection has to move off it. Keeping this in an
  // effect rather than in the run handler means it also covers reset and trial switches.
  useEffect(() => {
    if (lump === null || !available.includes(lump)) setLump(available[0] ?? null);
  }, [available, lump]);

  const settings = TESTS[test].settings;
  // The dial only means anything for the bath and the lamp; default to the first value so Run
  // never has to cope with a test that needs a setting and hasn't got one.
  useEffect(() => {
    setSetting(settings.length > 0 ? settings[0].id : null);
  }, [settings]);

  const exhausted = available.length === 0;

  return (
    <div className="test-settings">
      <div className="settings-grid">
        <Select
          className="lump-select"
          label="Lump"
          options={available.map((id) => ({ id, label: id }))}
          selectedKey={lump}
          onSelectionChange={(id) => setLump(id as LumpId)}
          isDisabled={exhausted}
          action="lump_selected"
        />
        <Select
          className="test-select"
          label="Test"
          options={CONSUMING_TESTS.map((id) => ({ id, label: TESTS[id].label }))}
          selectedKey={test}
          onSelectionChange={(id) => setTest(id as TestId)}
          isDisabled={exhausted}
          action="test_selected"
        />
        <Select
          className="setting-select"
          label="Setting"
          options={settings.map((s) => ({ id: String(s.id), label: s.label }))}
          selectedKey={setting === null ? null : String(setting)}
          onSelectionChange={(id) => setSetting(id as SettingId)}
          isDisabled={settings.length === 0 || exhausted}
          placeholder="—"
          action="setting_selected"
        />
      </div>
      <div className="settings-actions">
        <Button
          onPress={() => lump && onRun(lump, test, setting)}
          isDisabled={running || exhausted || lump === null}
        >
          Run
        </Button>
        <Button onPress={onResetTrial} isDisabled={running}>
          Reset Trial
        </Button>
      </div>
      {exhausted ? (
        <p className="exhausted-note">
          No material left in this trial. Start a new trial to test these lumps again.
        </p>
      ) : null}
    </div>
  );
}
