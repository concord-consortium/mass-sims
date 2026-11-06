import clsx from "clsx";
import { lastSeen } from "../model/observe";
import { LUMP_ASSIGNMENT, LUMP_IDS } from "../model/substances";
import { TESTS } from "../model/tests";
import type { Trial } from "../model/trial";

import "./trial-card-body.scss";

/**
 * The rows inside a shared <TrialCard>: one per sample that has been given a test, listing the
 * test and its dial behind a small picture of the sample as it was left. Nor'easter's cards
 * list the settings that were chosen, and these do the same — the observations themselves are
 * in the Data panel.
 */
export function TrialCardBody({ trial }: { trial: Trial }) {
  const spent = LUMP_IDS.filter((lump) => trial.lumps[lump].result !== null);
  if (spent.length === 0) return <span className="trial-card-empty">no tests yet</span>;
  return (
    <>
      {spent.map((lump) => {
        const record = trial.lumps[lump];
        if (!record.result) return null;
        const meta = TESTS[record.result.test];
        const option = meta.settings.find((s) => String(s.id) === String(record.result?.setting));
        return (
          <span className="card-row" key={lump}>
            <span
              className={clsx("card-blob", `visual-${lastSeen(LUMP_ASSIGNMENT[lump], record)}`)}
              aria-hidden="true"
            />
            Sample {lump} · {meta.label}
            {option ? ` ${option.label}` : ""}
          </span>
        );
      })}
    </>
  );
}
