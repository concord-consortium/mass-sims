import { useState } from "react";
import {
  COLUMNS,
  type ColumnId,
  computeStat,
  FIXED_COLUMN_IDS,
  formatValue,
  type SampleRow,
  STATS,
  type StatId,
} from "../model/sim";
import { LandscapeThumbnail } from "./landscape-thumbnail";
import "./data-table.scss";

interface DataTableProps {
  rows: SampleRow[];
  summaryStat: StatId;
  onChangeSummaryStat: (stat: StatId) => void;
  onDeleteRow: (id: string) => void;
  selectedRowId: string | null;
  onSelectRow: (id: string) => void;
}

type SortKey = "yearsBeforeCollapse" | ColumnId;
type SortDir = "asc" | "desc";

const sortGetter = (key: SortKey): ((r: SampleRow) => number) =>
  key === "yearsBeforeCollapse"
    ? (r) => r.yearsBeforeCollapse
    : (COLUMNS.find((c) => c.id === key)?.get ?? ((r) => r.yearsBeforeCollapse));

// The three fixed columns, in order — not pickable or reorderable.
const cols = FIXED_COLUMN_IDS.map((id) => COLUMNS.find((c) => c.id === id)).filter(
  (c): c is (typeof COLUMNS)[number] => !!c,
);

/** One experiment's table: pinned header/footer and a scrollable, row-sortable body. The columns are
 *  fixed (Erosion rate, Dissolved rock, Total depth); the experiment name lives in the sampler row. */
export function DataTable({
  rows,
  summaryStat,
  onChangeSummaryStat,
  onDeleteRow,
  selectedRowId,
  onSelectRow,
}: DataTableProps) {
  const colSpan = cols.length + 3; // landscape + year + data columns + delete

  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);
  const toggleSort = (key: SortKey) =>
    setSort((prev) =>
      prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  const sortedRows = sort
    ? [...rows].sort(
        (a, b) =>
          (sortGetter(sort.key)(a) - sortGetter(sort.key)(b)) * (sort.dir === "asc" ? 1 : -1),
      )
    : rows;

  const sortGlyph = (key: SortKey) => (sort?.key === key ? (sort.dir === "asc" ? "▲" : "▼") : "⇅");

  return (
    <div className="data-table">
      <table className="grid-table">
        <thead>
          <tr>
            <th className="col-landscape" aria-label="Landscape" />
            <th className="col-year">
              <button
                type="button"
                className="sort-btn"
                onClick={() => toggleSort("yearsBeforeCollapse")}
              >
                <span className="sort-label">Years before collapse</span>
                <span className="sort-caret">{sortGlyph("yearsBeforeCollapse")}</span>
              </button>
            </th>
            {cols.map((col) => (
              <th key={col.id}>
                <div className="col-picker">
                  <span className="col-name">{col.label}</span>
                  <div className="col-meta">
                    <span className="col-unit">{col.unit}</span>
                    <button
                      type="button"
                      className="col-sort"
                      aria-label={`Sort by ${col.label}`}
                      onClick={() => toggleSort(col.id)}
                    >
                      {sortGlyph(col.id)}
                    </button>
                  </div>
                </div>
              </th>
            ))}
            <th className="col-delete" aria-label="Delete" />
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr className="empty-row">
              <td colSpan={colSpan}>Set years before collapse and press Sample to add a row.</td>
            </tr>
          ) : (
            sortedRows.map((r) => (
              <tr
                key={r.id}
                className={r.id === selectedRowId ? "is-selected" : undefined}
                aria-selected={r.id === selectedRowId}
                onClick={() => onSelectRow(r.id)}
              >
                <td className="col-landscape">
                  <LandscapeThumbnail combo={r.combo} row={r} className="thumb-cell" />
                </td>
                <td className="col-year">{r.yearsBeforeCollapse.toLocaleString()}</td>
                {cols.map((col) => (
                  <td key={col.id}>{formatValue(col, col.get(r))}</td>
                ))}
                <td className="col-delete">
                  <button
                    type="button"
                    className="delete-row"
                    aria-label={`Delete the ${r.yearsBeforeCollapse.toLocaleString()} year row`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteRow(r.id);
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
        {rows.length > 0 && cols.length > 0 ? (
          <tfoot>
            <tr>
              <td className="col-landscape" />
              <th className="col-year">
                <select
                  className="summary-select"
                  aria-label="Summary statistic"
                  value={summaryStat}
                  onChange={(e) => onChangeSummaryStat(e.target.value as StatId)}
                >
                  {STATS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </th>
              {cols.map((col) => (
                <td key={col.id}>
                  {formatValue(col, computeStat(summaryStat, rows.map(col.get)))}
                </td>
              ))}
              <td className="col-delete" />
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
