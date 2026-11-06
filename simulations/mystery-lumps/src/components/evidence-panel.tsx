import { DataSubsection } from "@concord-consortium/mass-sims-shared";
import clsx from "clsx";
import { examine, lastSeen, massAfter, observe } from "../model/observe";
import { LUMP_ASSIGNMENT, LUMP_IDS, type LumpId, startingMass } from "../model/substances";
import { TESTS } from "../model/tests";
import type { Trial } from "../model/trial";

import "./evidence-panel.scss";

/**
 * Everything observed in this trial, in full prose, each lump beside a picture of how it was
 * last seen. This is the only place a result survives once the lump has left the bench, so it
 * is both the running record and — since the sim asks for no identification — the deliverable
 * a student copies onto the paper assignment.
 */
export function EvidencePanel({
  trial,
  runningLump = null,
}: {
  trial: Trial;
  /** The lump whose test is still under way, so its outcome isn't known yet. */
  runningLump?: LumpId | null;
}) {
  const rows = LUMP_IDS.map((lump) => {
    const record = trial.lumps[lump];
    const substance = LUMP_ASSIGNMENT[lump];
    const result = record.result;

    // In the order they happened: what the lump was like, what the test did, what it was like
    // afterwards. The before-and-after pair is the argument a student writes up, so both sides
    // are kept rather than the later one overwriting the earlier.
    const lines: { key: string; label?: string; text: string }[] = [];
    if (record.examined.before) {
      lines.push({ key: "examined-before", text: examine(substance).caption });
    }
    if (result) {
      lines.push({
        key: "result",
        label: TESTS[result.test].label,
        text: lump === runningLump ? "Running…" : observe(substance, result.test).caption,
      });
      const before = startingMass(lump);
      const after = massAfter(substance, result.test, before);
      lines.push({
        key: "mass",
        label: "Mass",
        text:
          lump === runningLump
            ? `${before.toFixed(1)} g before the test.`
            : `${before.toFixed(1)} g before the test, ${after.toFixed(1)} g after.`,
      });
    }
    if (record.examined.after) {
      lines.push({ key: "examined-after", text: examine(substance, result).caption });
    }

    return { lump, visual: lastSeen(substance, record), lines };
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
                <span className="evidence-lump">Sample {row.lump}</span>
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
