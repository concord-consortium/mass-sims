import type { RefObject } from "react";
import { SORT_NAMES } from "../../hooks/use-sample-actions";
import type { SortKey, SortState } from "../../model/types";
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

type SortDir = "ascending" | "descending" | "none";

function sortDirOf(sort: SortState, key: SortKey): SortDir {
  if (sort.key !== key) return "none";
  return sort.direction === 1 ? "ascending" : "descending";
}

// A placeholder: two triangles, the sorted direction solid. Swap the paths when the real artwork
// lands. 2px pad, 7.5 triangle, 3px gap, 7.5 triangle, 2px pad = the 22px box.
function SortIcon() {
  return (
    <svg
      className="collapse-sort-ico"
      width="14"
      height="22"
      viewBox="0 0 14 22"
      aria-hidden="true"
    >
      <path className="sort-up" fill="currentColor" d="M7 2 L13 9.5 L1 9.5 Z" />
      <path className="sort-down" fill="currentColor" d="M7 20 L1 12.5 L13 12.5 Z" />
    </svg>
  );
}

interface TableHeadProps {
  sort: SortState;
  hasPrompt: boolean;
  onSort: (key: SortKey) => void;
  headRowRef: RefObject<HTMLTableRowElement | null>;
}

/**
 * The header row. Each measurement heading is a sort button inside its `th`, with `aria-sort` on
 * the `th` (the APG sortable-table pattern). The button's name is the heading without its unit,
 * which is also what the sort announcement says.
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
          const dir = sortDirOf(sort, col.key);
          return (
            <th key={col.key} scope="col" aria-sort={dir} data-sort-dir={dir}>
              <button
                type="button"
                className="collapse-th-sort"
                aria-label={SORT_NAMES[col.key]}
                onClick={() => onSort(col.key)}
              >
                <span className="collapse-th-lines">
                  {col.l1}
                  <br />
                  <span className="collapse-th-unit">{col.l2}</span>
                </span>
                <SortIcon />
              </button>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
