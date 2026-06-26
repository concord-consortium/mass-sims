import { observer } from "mobx-react-lite";
import type { ReactNode } from "react";
import FungusAddedIcon from "../../assets/icons/fungus-added.svg?react";
import { aggregateTotals } from "../../model/data-aggregations";
import { PARENT_LABELS, type ParentId } from "../../model/genetics";
import type { TrialModelInstance } from "../../stores/trial-model";

const ELLIPSIS = "…";

/** "Wild W1" → "W1": the last whitespace-separated word of a parent's display label. */
export function abbrev(name: string): string {
  return name.split(" ").pop() ?? name;
}

/** Abbreviated display label for a parent id, or `null` when the parent is unset. */
function abbrevParent(id: string | null): string | null {
  return id ? abbrev(PARENT_LABELS[id as ParentId]) : null;
}

/**
 * The enriched screen-reader label for a trial card: "Trial A. W1 crossed with C1. 12 offspring, 9
 * healthy, 3 infected. Fungus active." Built inline from live trial state (NOT memoized) so the
 * orchestrator — which is `observer`-wrapped — recomputes it whenever the trial mutates. Passed to
 * the shared `<TrialCard>` via its `ariaLabel` prop, mirroring the visible (aria-hidden) body —
 * including the Fungus row.
 */
export function trialAriaLabel(letter: string, trial: TrialModelInstance): string {
  const p1 = abbrevParent(trial.p1);
  const p2 = abbrevParent(trial.p2);
  const parts = [`Trial ${letter}`];
  if (p1 && p2) parts.push(`${p1} crossed with ${p2}`);
  else if (p1) parts.push(`${p1}, second parent not selected`);
  else if (p2) parts.push(`${p2}, first parent not selected`);
  if (trial.crosses.length > 0) {
    const { healthy, infected } = aggregateTotals(trial.crosses);
    parts.push(`${healthy + infected} offspring, ${healthy} healthy, ${infected} infected`);
  }
  if (trial.fungusOn) parts.push("Fungus active");
  return parts.join(". ");
}

/**
 * The visible body of a trial card (the shared `<TrialCard>`'s `children`): a parents row, an
 * offspring count, and a Healthy/Infected percentage row. Rendered from live trial views and
 * `observer`-wrapped so it tracks mutations. `aria-hidden` because the card's accessible name is the
 * enriched `ariaLabel` (see `trialAriaLabel`) — the visible text would otherwise be redundant.
 *
 * Row visibility: the parents row is omitted entirely until at least one parent is picked; the
 * offspring count and percentage row appear only once the trial has crosses.
 */
export const TrialCardBody = observer(function TrialCardBody({
  trial,
}: {
  trial: TrialModelInstance;
}) {
  const p1 = abbrevParent(trial.p1);
  const p2 = abbrevParent(trial.p2);

  let offspringRow: ReactNode = null;
  let phenotypeRow: ReactNode = null;
  if (trial.crosses.length > 0) {
    const { healthy, infected } = aggregateTotals(trial.crosses);
    const total = healthy + infected;
    const healthyPct = Math.round((healthy / total) * 100);
    const infectedPct = 100 - healthyPct;
    offspringRow = <span className="trial-card-offspring">Offspring: {trial.totalOffspring}</span>;
    phenotypeRow = (
      <span className="trial-card-phenotypes">
        <span className="trial-card-swatch trial-card-swatch--healthy" />
        <span>{healthyPct}%</span>
        <span className="trial-card-swatch trial-card-swatch--infected" />
        <span>{infectedPct}%</span>
      </span>
    );
  }

  return (
    <div className="trial-card-body" aria-hidden="true">
      {p1 || p2 ? (
        <span className="trial-card-parents">
          <span className="trial-card-parent trial-card-parent--left">{p1 ?? ELLIPSIS}</span>
          <span className="trial-card-cross">×</span>
          <span className="trial-card-parent trial-card-parent--right">{p2 ?? ELLIPSIS}</span>
        </span>
      ) : null}
      {offspringRow}
      {phenotypeRow}
      {trial.fungusOn ? (
        <>
          {/* Before any cross, two empty rows stand in for the offspring + percentage rows so the
              Fungus label always lands at the bottom of the card. */}
          {trial.crosses.length === 0 ? (
            <>
              <span className="trial-card-row-spacer">{" "}</span>
              <span className="trial-card-row-spacer">{" "}</span>
            </>
          ) : null}
          <span className="trial-card-fungus">
            <span className="trial-card-fungus-badge">
              <FungusAddedIcon className="trial-card-fungus-icon" aria-hidden="true" />
            </span>
            Fungus
          </span>
        </>
      ) : null}
    </div>
  );
});
