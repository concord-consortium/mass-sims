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
    const result = record.result;

    // In the order they happened: what the lump was like, what the test did, what it was like
    // afterwards. The before-and-after pair is the argument a student writes up, so both sides
    // are kept rather than the later one overwriting the earlier.
    const lines: { key: string; label?: string; text: string }[] = [];
    if (record.handled.before) {
      lines.push({ key: "handled-before", text: observe(substance, "handle", null).caption });
    }
    if (record.wafted.before) {
      lines.push({ key: "wafted-before", text: observe(substance, "waft", null).caption });
    }
    if (result) {
      lines.push({
        key: "result",
        label: describeTest(result.test, result.setting),
        text: observe(substance, result.test, result.setting).caption,
      });
    }
    if (record.handled.after) {
      lines.push({
        key: "handled-after",
        text: observe(substance, "handle", null, result).caption,
      });
    }
    if (record.wafted.after) {
      lines.push({ key: "wafted-after", text: observe(substance, "waft", null, result).caption });
    }

    // The picture shows the lump as it was last seen: its test's end state if it has one,
    // otherwise whatever handling revealed, otherwise the anonymous blob.
    const visual = result
      ? observe(substance, result.test, result.setting).visual
      : record.handled.before
        ? observe(substance, "handle", null).visual
        : "unknown";

    return { lump, visual, lines };
  }).filter((r) => r.lines.length > 0);

  return (
    <DataSubsection title="What you've observed">
      {rows.length === 0 ? (
        <p className="evidence-empty">
          Nothing observed yet. Put a lump on the bench and look at it.
        </p>
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
              {row.lines.map((line) => (
                <p className="evidence-note" key={line.key}>
                  {line.label ? <span className="evidence-test">{line.label}</span> : null}
                  {line.label ? " — " : null}
                  {line.text}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </DataSubsection>
  );
}
