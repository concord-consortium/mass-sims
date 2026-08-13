import { useState } from "react";
import {
  COLUMNS,
  type ColumnId,
  computeStat,
  formatValue,
  type SampleRow,
  STATS,
  type StatId,
} from "../model/sim";
import { LandscapeThumbnail } from "./landscape-thumbnail";
import "./data-table.scss";

interface DataTableProps {
  rows: SampleRow[];
  selectedColumns: ColumnId[];
  onSetColumns: (cols: ColumnId[]) => void;
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

/** One experiment's table: pinned header/footer, a scrollable sortable body, and per-column
 *  measurement dropdowns (the "＋ column" and experiment name live in the sampler row). */
export function DataTable({
  rows,
  selectedColumns,
  onSetColumns,
  summaryStat,
  onChangeSummaryStat,
  onDeleteRow,
  selectedRowId,
  onSelectRow,
}: DataTableProps) {
  const cols = selectedColumns
    .map((id) => COLUMNS.find((col) => col.id === id))
    .filter((col): col is (typeof COLUMNS)[number] => !!col);
  const available = COLUMNS.filter((col) => !selectedColumns.includes(col.id));
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

  const swapColumn = (oldId: ColumnId, value: string) => {
    if (value === "__remove") onSetColumns(selectedColumns.filter((id) => id !== oldId));
    else onSetColumns(selectedColumns.map((id) => (id === oldId ? (value as ColumnId) : id)));
  };
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
                  <select
                    className="col-select"
                    aria-label={`Measurement: ${col.label}`}
                    value={col.id}
                    onChange={(e) => swapColumn(col.id, e.target.value)}
                  >
                    <option value={col.id}>{col.label}</option>
                    {available.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                    <option value="__remove">— remove —</option>
                  </select>
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
