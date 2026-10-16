import { DataSubsection } from "@concord-consortium/mass-sims-shared";
import clsx from "clsx";
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
 * Everything observed in this trial, in full prose, each lump beside a picture of how it was
 * last seen. This is the only place a result survives once the lump has left the bench, so it
 * is both the running record and — since the sim asks for no identification — the deliverable
 * a student copies onto the paper assignment.
 */
export function EvidencePanel({ trial }: { trial: Trial }) {
  const rows = LUMP_IDS.map((lump) => {
    const record = trial.lumps[lump];
    const substance = LUMP_ASSIGNMENT[lump];
    // The picture shows the lump as it was last seen: its test's end state if it has one,
    // otherwise whatever handling revealed, otherwise the anonymous blob.
    const visual = record.result
      ? observe(substance, record.result.test, record.result.setting).visual
      : record.handled
        ? observe(substance, "handle", null).visual
        : "unknown";
    return {
      lump,
      visual,
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
              <div className="evidence-head">
                <span
                  className={clsx("evidence-blob", `visual-${row.visual}`)}
                  aria-hidden="true"
                />
                <span className="evidence-lump">Lump {row.lump}</span>
              </div>
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
