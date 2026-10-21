import { observer } from "mobx-react-lite";
import type { TrialModelInstance } from "../../stores/trial-model";

/**
 * The enriched screen-reader label for a trial card: "Trial A. Walker count 50, step size 1" for an
 * unrun trial, with "Average distance 12.3" appended once it has run. Built inline from live trial
 * state (NOT memoized) so the `observer`-wrapped orchestrator recomputes it whenever the trial
 * mutates. Passed to the shared `<TrialCard>` via its `ariaLabel` prop.
 */
export function trialAriaLabel(letter: string, trial: TrialModelInstance): string {
  const parts = [
    `Trial ${letter}`,
    `Walker count ${trial.input.walkerCount}, step size ${trial.input.stepSize}`,
  ];
  if (trial.output) {
    // Spell out σ ("standard deviation") for screen readers, and match the visible avg/σ body so SR
    // users get the same data sighted users see (the visible body is aria-hidden).
    parts.push(
      `Average distance ${trial.output.avgDistance.toFixed(1)}, standard deviation ${trial.output.stdDevDistance.toFixed(1)}`,
    );
  }
  return parts.join(". ");
}

/**
 * The visible body of a trial card (the shared `<TrialCard>`'s `children`): the recorded average
 * distance and standard deviation, shown only once the trial has run. Rendered from live trial state
 * and `observer`-wrapped so it tracks mutations. `aria-hidden` because the card's accessible name is
 * the enriched `ariaLabel` (see `trialAriaLabel`) — the visible text would otherwise be redundant.
 */
export const TrialCardBody = observer(function TrialCardBody({
  trial,
}: {
  trial: TrialModelInstance;
}) {
  if (!trial.output) return null;
  return (
    <div className="trial-card-body" aria-hidden="true">
      <span>avg {trial.output.avgDistance.toFixed(1)}</span>
      <span>σ {trial.output.stdDevDistance.toFixed(1)}</span>
    </div>
  );
});
