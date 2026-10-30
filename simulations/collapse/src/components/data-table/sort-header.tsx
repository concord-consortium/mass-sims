import type { ReactNode } from "react";
import type { SortKey, SortState } from "../../model/types";

type SortDir = "ascending" | "descending" | "none";

export function sortDirOf(sort: SortState, key: SortKey): SortDir {
  if (sort.key !== key) return "none";
  return sort.direction === 1 ? "ascending" : "descending";
}

// A placeholder: two triangles, the sorted direction solid. Swap the paths when the real artwork
// lands. 2px pad, 7.5 triangle, 3px gap, 7.5 triangle, 2px pad = the 22px box.
export function SortIcon() {
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

interface SortHeaderProps {
  dir: SortDir;
  label: ReactNode;
  /** The button's name, when it is not the visible label. */
  name?: string;
  onSort: () => void;
}

/**
 * A sortable column heading: a sort button inside its `th`, with `aria-sort` on the `th` (the APG
 * sortable-table pattern).
 */
export function SortHeader({ dir, label, name, onSort }: SortHeaderProps) {
  return (
    <th scope="col" aria-sort={dir} data-sort-dir={dir}>
      <button type="button" className="collapse-th-sort" aria-label={name} onClick={onSort}>
        {label}
        <SortIcon />
      </button>
    </th>
  );
}
