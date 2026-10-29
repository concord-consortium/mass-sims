import { observer } from "mobx-react-lite";
import { useRef } from "react";
import { useSampleActions } from "../../hooks/use-sample-actions";
import type { Sample, SortState } from "../../model/types";
import { useStores } from "../../stores/root-store";
import { type CollapseTrialLetter, TRIAL_CONDITIONS } from "../../trial-conditions";
import { SampleRow } from "./sample-row";
import { TableFoot } from "./table-foot";
import { TableHead } from "./table-head";
import { useFillerHeight } from "./use-filler-height";
import { useRowFlip } from "./use-row-flip";
import { useRowKeyboardNav } from "./use-row-keyboard-nav";
import "./data-table.scss";

/** A sorted copy, so the trial keeps the order the student sampled in. */
function sortedSamples(samples: readonly Sample[], { key, direction }: SortState): Sample[] {
  const view = samples.slice();
  if (key) view.sort((a, b) => (a[key] - b[key]) * direction);
  return view;
}

/**
 * The selected trial's samples, as one native table in one scroller. The header and the average
 * row are sticky cells, so they stay pinned while the rows scroll between them, and the average row
 * is always at the bottom of the box.
 */
export const DataTable = observer(function DataTable() {
  const store = useStores();
  const { ui } = store;
  const trial = store.activeTrial;
  const letter = ui.selectedTrialLetter;
  const conditions = TRIAL_CONDITIONS[letter as CollapseTrialLetter];
  const { selectSample, deleteSample, cycleSort } = useSampleActions();
  const selectedId = store.selectedSample?.id;
  const rows = sortedSamples(trial.samples, ui.sort);
  const count = trial.sampleCount;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const fillerRef = useRef<HTMLTableRowElement>(null);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const headRowRef = useRef<HTMLTableRowElement>(null);
  // Ids are unique only within a trial, so rows are keyed by trial too: a trial switch remounts
  // every row rather than reusing one trial's row for another's sample.
  const rowKeys = rows.map((sample) => `${letter}:${sample.id}`);
  useFillerHeight(scrollerRef, fillerRef, count);
  const { rememberFocus } = useRowKeyboardNav(tbodyRef, headRowRef, scrollerRef, count);
  useRowFlip(tbodyRef, scrollerRef, letter, rowKeys);

  return (
    <div className="collapse-stage">
      <div className="collapse-table-wrap" ref={scrollerRef}>
        <table className="collapse-table">
          <caption className="sr-only">
            {count === 0
              ? `Samples for trial ${letter}: no rows yet.`
              : `Samples for trial ${letter}: ${count} ${count === 1 ? "row" : "rows"}.`}
          </caption>
          <TableHead
            sort={ui.sort}
            hasPrompt={count === 0}
            onSort={cycleSort}
            headRowRef={headRowRef}
          />
          <tbody className="collapse-rows" ref={tbodyRef}>
            {rows.map((sample, i) => (
              <SampleRow
                key={rowKeys[i]}
                rowKey={rowKeys[i]}
                sample={sample}
                conditions={conditions}
                selected={sample.id === selectedId}
                onSelect={() => selectSample(sample.id)}
                onDelete={() => {
                  rememberFocus();
                  deleteSample(sample.id);
                }}
              />
            ))}
          </tbody>
          {trial.averageRate !== null && trial.averageRoof !== null && (
            <>
              {/* Sized by `useFillerHeight`. */}
              <tbody className="collapse-filler" aria-hidden="true">
                <tr ref={fillerRef}>
                  <td colSpan={5} />
                </tr>
              </tbody>
              <TableFoot averageRate={trial.averageRate} averageRoof={trial.averageRoof} />
            </>
          )}
        </table>
      </div>
      {count === 0 && (
        // Outside the table, since a `div` is not valid in a `thead`. Sits on the header's rule.
        <div className="collapse-head-prompt">
          <div className="collapse-prompt-pill">
            Pick a year, then click <b>Sample</b>
          </div>
        </div>
      )}
    </div>
  );
});
