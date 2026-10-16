import { LUMP_IDS } from "../model/substances";
import { TESTS } from "../model/tests";
import type { Trial } from "../model/trial";

/**
 * The rows inside a shared <TrialCard>: one per lump that has been given a test, listing the
 * test and its dial. Nor'easter's cards list the settings that were chosen, and these do the
 * same — the observations themselves are in the Data panel.
 */
export function TrialCardBody({ trial }: { trial: Trial }) {
  const spent = LUMP_IDS.filter((lump) => trial.lumps[lump].result !== null);
  if (spent.length === 0) return <span className="trial-card-empty">no tests yet</span>;
  return (
    <>
      {spent.map((lump) => {
        const result = trial.lumps[lump].result;
        if (!result) return null;
        const meta = TESTS[result.test];
        const option = meta.settings.find((s) => String(s.id) === String(result.setting));
        return (
          <span key={lump}>
            {lump} · {meta.label}
            {option ? ` ${option.label}` : ""}
          </span>
        );
      })}
    </>
  );
}
