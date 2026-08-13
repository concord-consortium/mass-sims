import type { SampleRow } from "../model/sim";
import { LandscapeThumbnail } from "./landscape-thumbnail";
import "./row-detail.scss";

interface RowDetailProps {
  row: SampleRow | null;
}

/** An enlarged landscape for the selected table row, shown below the graph; a prompt when none. */
export function RowDetail({ row }: RowDetailProps) {
  if (!row) {
    return (
      <div className="row-detail row-detail-empty">
        Click a row in the table to see its landscape.
      </div>
    );
  }
  return (
    <div className="row-detail">
      <span className="row-detail-year">
        {row.yearsBeforeCollapse.toLocaleString()} yr before collapse
      </span>
      <LandscapeThumbnail combo={row.combo} row={row} className="row-detail-image" />
    </div>
  );
}
