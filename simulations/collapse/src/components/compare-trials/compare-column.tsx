import { smoothScrollIntoView } from "@concord-consortium/mass-sims-shared";
import { observer } from "mobx-react-lite";
import { useLayoutEffect, useRef } from "react";
import { useCompareActions } from "../../hooks/use-compare-actions";
import { useSampleActions } from "../../hooks/use-sample-actions";
import { sortedSamples } from "../../model/sort-samples";
import type { SortKey } from "../../model/types";
import { useStores } from "../../stores/root-store";
import { type CollapseTrialLetter, MOISTURE_NOTES, TRIAL_CONDITIONS } from "../../trial-conditions";
import { SortHeader, sortDirOf } from "../data-table/sort-header";
import { TableFoot } from "../data-table/table-foot";
import { COLUMN_NAMES } from "../data-table/table-head";
import { useFillerHeight } from "../data-table/use-filler-height";
import { useHeadingSpacing } from "../data-table/use-heading-spacing";
import { useRowFlip } from "../data-table/use-row-flip";
import { ConditionAttr, MOISTURE_ICONS, ROCK_ICONS } from "../trials-panel/trial-card-body";
import { CompareRow } from "./compare-row";
import "../data-table/table-shared.scss";

const COLUMNS: readonly { key: SortKey; label: string }[] = [
  { key: "years", label: "Years" },
  { key: "rate", label: "Rate" },
  { key: "roof", label: "Rock" },
];

interface CompareColumnProps {
  letter: CollapseTrialLetter;
  linkedYear: number | null;
  onHover: (years: number | null) => void;
}

/**
 * One trial: its letter, conditions and note, then its samples as a table in its own scroller.
 * The heading and the average row are sticky cells, as in the data table.
 */
export const CompareColumn = observer(function CompareColumn({
  letter,
  linkedYear,
  onHover,
}: CompareColumnProps) {
  const store = useStores();
  const { ui } = store;
  const trial = store.trials.get(letter);
  const { cycleSort } = useSampleActions();
  const { togglePin } = useCompareActions();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const fillerRef = useRef<HTMLTableRowElement>(null);
  const headRowRef = useRef<HTMLTableRowElement>(null);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const conditions = TRIAL_CONDITIONS[letter];
  const { rock, moisture } = conditions;
  const count = trial?.sampleCount ?? 0;
  useFillerHeight(scrollerRef, fillerRef, count);
  // The headings sit closer than the data table's: 8px between two headings instead of 16, and each
  // hover band reaches 4px past its label and chevron instead of 8. There are three headings in a
  // quarter of the width. The right band stays inside the column; the Years heading may reach over
  // the thumbnail column.
  useHeadingSpacing(headRowRef, { gap: 8, minBandPadding: 4, clampRight: true });
  const rows = trial ? sortedSamples(trial.samples, ui.sort) : [];
  const rowKeys = rows.map((sample) => `${letter}:${sample.id}`);
  useRowFlip(tbodyRef, scrollerRef, letter, rowKeys);
  // Bring the pinned year's topmost row into view, including the year carried in on opening.
  useLayoutEffect(() => {
    if (ui.pinnedYear === null) return;
    const row = tbodyRef.current?.querySelector(`tr[data-year="${ui.pinnedYear}"]`);
    if (row) smoothScrollIntoView(row);
  }, [ui.pinnedYear]);
  if (!trial) return null;

  return (
    <div className="collapse-compare-col">
      {/* The table's caption names the trial and its conditions for assistive tech. */}
      <div className="collapse-compare-colhead" aria-hidden="true">
        <div className="collapse-compare-trial">
          <div className="collapse-compare-letter">{letter}</div>
        </div>
        <div className="collapse-compare-cond">
          <ConditionAttr icon={ROCK_ICONS[rock]} label={rock} />
          <ConditionAttr icon={MOISTURE_ICONS[moisture]} label={moisture} />
        </div>
        <div className="collapse-compare-note">{MOISTURE_NOTES[moisture].text}</div>
      </div>
      <div className="collapse-compare-rows" ref={scrollerRef}>
        <div className="collapse-compare-sizer">
          <table className="collapse-compare-tbl">
            <caption className="sr-only">
              {`Trial ${letter}, ${rock}, ${moisture}, ${MOISTURE_NOTES[moisture].spoken}: `}
              {count === 0 ? "no samples yet" : `${count} ${count === 1 ? "sample" : "samples"}`}
            </caption>
            <colgroup>
              <col className="cmp-pic" />
              <col className="cmp-years" />
              <col className="cmp-rate" />
              <col className="cmp-rock" />
            </colgroup>
            <thead>
              <tr ref={headRowRef}>
                <th scope="col">
                  <span className="sr-only">Cave</span>
                </th>
                {COLUMNS.map(({ key, label }) => (
                  <SortHeader
                    key={key}
                    dir={sortDirOf(ui.sort, key)}
                    label={<span className="collapse-compare-th-label">{label}</span>}
                    name={COLUMN_NAMES[key]}
                    onSort={() => cycleSort(key, "compare")}
                  />
                ))}
              </tr>
            </thead>
            <tbody className="collapse-rows" ref={tbodyRef}>
              {rows.map((sample, i) => (
                <CompareRow
                  key={rowKeys[i]}
                  sample={sample}
                  letter={letter}
                  conditions={conditions}
                  tabStop={i === 0}
                  linked={sample.years === linkedYear}
                  pinned={ui.isPinned(sample.years)}
                  onHover={onHover}
                  onPin={() => togglePin(sample.years)}
                />
              ))}
            </tbody>
            {trial.averageRate !== null && trial.averageRoof !== null && (
              <>
                {/* Sized by `useFillerHeight`. */}
                <tbody className="collapse-filler" aria-hidden="true">
                  <tr ref={fillerRef}>
                    <td colSpan={4} />
                  </tr>
                </tbody>
                <TableFoot
                  averageRate={trial.averageRate}
                  averageRoof={trial.averageRoof}
                  headingOverPicture
                  trailingCell={false}
                />
              </>
            )}
          </table>
        </div>
        {count === 0 && <div className="collapse-compare-empty">No samples taken yet</div>}
      </div>
    </div>
  );
});
