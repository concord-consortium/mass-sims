import clsx from "clsx";
import { observe } from "../model/observe";
import { LUMP_ASSIGNMENT, type LumpId } from "../model/substances";
import { type SettingId, TESTS, type TestId } from "../model/tests";
import type { Trial } from "../model/trial";

import "./test-lab.scss";

export interface TestLabProps {
  trial: Trial;
  /** The lump on the bench, spent or not, or null when the tray has not been used yet. */
  selectedLump: LumpId | null;
  test: TestId;
  setting: SettingId | null;
  running: boolean;
  /** The most recent observation's caption, cleared when a different lump comes to the bench. */
  message: string | null;
}

/**
 * The bench. One lump at a time, with the apparatus for the currently chosen test standing on
 * it, and a caption for whatever was last observed.
 *
 * A spent lump stays here until a different one is picked, which is the window in which Observe
 * and Waft can still reach it — the only route to the rancid smell after the lamp.
 */
export function TestLab({ trial, selectedLump, test, setting, running, message }: TestLabProps) {
  const record = selectedLump ? trial.lumps[selectedLump] : null;
  const substance = selectedLump ? LUMP_ASSIGNMENT[selectedLump] : null;
  // Once spent, the lump wears the state its test left it in. Before that it is a plain blob,
  // or whatever handling revealed.
  const resting =
    substance && record?.result
      ? observe(substance, record.result.test, record.result.setting).visual
      : substance && record?.handled
        ? observe(substance, "handle", null).visual
        : "unknown";

  return (
    <div className="test-lab">
      <div className="lab-title">Test Lab</div>
      <div className={clsx("bench", { running })}>
        {selectedLump === null ? (
          <p className="bench-prompt">Pick a lump from the tray to put it on the bench.</p>
        ) : (
          <>
            <div className={clsx("apparatus", `tool-${test}`)} aria-hidden="true">
              <span className="tool-label">{toolLabel(test, setting)}</span>
            </div>
            <div className="bench-lump">
              <span className={clsx("bench-blob", `visual-${resting}`)} aria-hidden="true" />
              <span className="bench-letter">Lump {selectedLump}</span>
            </div>
          </>
        )}
        {message ? <p className="bench-message">{message}</p> : null}
      </div>
    </div>
  );
}

/** What the drawn apparatus is called, for the student and for the placeholder art's caption. */
const TOOL_LABELS: Record<TestId, string> = {
  water: "beaker of water",
  vinegar: "tube of vinegar",
  bath: "warm water bath",
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
