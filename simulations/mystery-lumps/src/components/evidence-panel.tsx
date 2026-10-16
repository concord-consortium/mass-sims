import { DataSubsection } from "@concord-consortium/mass-sims-shared";
import { observe } from "../model/observe";
import { LUMP_ASSIGNMENT, LUMP_IDS } from "../model/substances";
import { type SettingId, TESTS, type TestId } from "../model/tests";
import type { Trial } from "../model/trial";

import "./evidence-panel.scss";

/** How a test and its dial read in the record: "Warm bath, 80 °C". */
function describeTest(test: TestId, setting: SettingId | null): string {
  const meta = TESTS[test];
  const option = meta.settings.find((s) => String(s.id) === String(setting));
  return option ? `${meta.label}, ${option.label}` : meta.label;
}

/**
 * Everything observed in this trial, in full prose. The sim asks for no identification, so this
 * panel is the deliverable — what a student copies onto the paper assignment.
 */
export function EvidencePanel({ trial }: { trial: Trial }) {
  const rows = LUMP_IDS.map((lump) => {
    const record = trial.lumps[lump];
    const substance = LUMP_ASSIGNMENT[lump];
    return {
      lump,
      handled: record.handled ? observe(substance, "handle", null).caption : null,
      smell: record.wafted ? observe(substance, "waft", null, record.result).caption : null,
      test: record.result ? describeTest(record.result.test, record.result.setting) : null,
      result: record.result
        ? observe(substance, record.result.test, record.result.setting).caption
        : null,
    };
  }).filter((r) => r.handled || r.smell || r.result);

  return (
    <DataSubsection title="What you've observed">
      {rows.length === 0 ? (
        <p className="evidence-empty">Nothing observed yet. Handle a lump, or run a test.</p>
      ) : (
        <ul className="evidence-list">
          {rows.map((row) => (
            <li key={row.lump}>
              <span className="evidence-lump">Lump {row.lump}</span>
              {row.handled ? <p className="evidence-note">{row.handled}</p> : null}
              {row.test ? (
                <p className="evidence-note">
                  <span className="evidence-test">{row.test}</span> — {row.result}
                </p>
              ) : null}
              {row.smell ? <p className="evidence-note">{row.smell}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </DataSubsection>
  );
}
