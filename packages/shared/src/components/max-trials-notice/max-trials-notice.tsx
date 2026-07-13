/**
 * Shown in place of the `+ New` card once `MAX_TRIALS` trials exist.
 *
 * Plain visible text — deliberately NOT `role="status"` / `aria-live`. The cap is narrated exactly
 * once, through the sim's single shared `<Announcer>`, when the last trial is created; a live region
 * here would double-announce it. See docs/accessibility.md ("Announcements — one polite region").
 *
 * **Styling is left to the consumer** (each sim's `trials-panel.scss` styles `.max-trials-notice`),
 * matching its `<NewTrialCard>` counterpart, which this replaces at the cap.
 */
export function MaxTrialsNotice() {
  return <div className="max-trials-notice">Max number of trials reached</div>;
}
