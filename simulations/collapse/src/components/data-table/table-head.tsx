import type { RefObject } from "react";
import type { SortKey, SortState } from "../../model/types";
import { SortHeader, sortDirOf } from "./sort-header";
import { useHeadingSpacing } from "./use-heading-spacing";

type Column = { srOnly: string } | { l1: string; l2: string; key: SortKey };

/** The five columns. The picture and delete columns have no visible heading. */
export const TABLE_COLS: readonly Column[] = [
  { srOnly: "Cave" },
  { l1: "Years before", l2: "collapse (yr)", key: "years" },
  { l1: "Erosion rate", l2: "(mm/1,000 yr)", key: "rate" },
  { l1: "Rock above", l2: "cave (mm)", key: "roof" },
  { srOnly: "Delete row" },
];

/** Each measurement column's full name: its two heading lines, joined. */
export const COLUMN_NAMES = Object.fromEntries(
  TABLE_COLS.flatMap((col) => ("key" in col ? [[col.key, `${col.l1} ${col.l2}`]] : [])),
) as Record<SortKey, string>;

interface TableHeadProps {
  sort: SortState;
  hasPrompt: boolean;
  onSort: (key: SortKey) => void;
  headRowRef: RefObject<HTMLTableRowElement | null>;
}

/**
 * The header row. Each measurement heading is a sort button inside its `th`, with `aria-sort` on
 * the `th` (the APG sortable-table pattern). The button's name is its visible text, unit included.
 */
export function TableHead({ sort, hasPrompt, onSort, headRowRef }: TableHeadProps) {
  useHeadingSpacing(headRowRef);

  return (
    <thead className={hasPrompt ? "collapse-thead has-prompt" : "collapse-thead"}>
      <tr ref={headRowRef}>
        {TABLE_COLS.map((col) => {
          if ("srOnly" in col) {
            return (
              <th key={col.srOnly} scope="col">
                <span className="sr-only">{col.srOnly}</span>
              </th>
            );
          }
          return (
            <SortHeader
              key={col.key}
              dir={sortDirOf(sort, col.key)}
              label={
                <span className="collapse-th-lines">
                  {/* The space keeps the two lines apart in the button's name. */}
                  {col.l1} <br />
                  <span className="collapse-th-unit">{col.l2}</span>
                </span>
              }
              onSort={() => onSort(col.key)}
            />
          );
        })}
      </tr>
    </thead>
  );
}
