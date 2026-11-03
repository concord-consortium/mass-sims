import type { KeyboardEvent } from "react";
import { type Conditions, formatWhole } from "../../model/erosion";
import type { Sample } from "../../model/types";
import { sampleRowLabel } from "../data-table/sample-row";
import { Thumbnail } from "../data-table/thumbnail";

interface CompareRowProps {
  sample: Sample;
  letter: string;
  conditions: Conditions;
  /** The column's one tab stop: its first row. */
  tabStop: boolean;
  linked: boolean;
  pinned: boolean;
  onHover: (years: number | null) => void;
  onPin: () => void;
}

/**
 * One sample in a trial's column. Hovering it links every row with the same year; pressing it, or
 * Enter or Space, pins that year. Pinned rows use `aria-current`, as the data table's selected row
 * does, and take its fill and marker.
 */
export function CompareRow({
  sample,
  letter,
  conditions,
  tabStop,
  linked,
  pinned,
  onHover,
  onPin,
}: CompareRowProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPin();
    }
  };

  return (
    // No `className`, as in `SampleRow`: the keyboard hook will write `kb-focus` on the row.
    <tr
      tabIndex={tabStop ? 0 : -1}
      aria-label={sampleRowLabel(sample, `Trial ${letter},`)}
      aria-current={pinned ? "true" : undefined}
      data-row-key={`${letter}:${sample.id}`}
      data-year={sample.years}
      data-linked={linked || undefined}
      onClick={onPin}
      onKeyDown={onKeyDown}
      onMouseEnter={() => onHover(sample.years)}
      onMouseLeave={() => onHover(null)}
    >
      <td className="cmp-pic">
        <Thumbnail conditions={conditions} years={sample.years} />
      </td>
      <td>{formatWhole(sample.years)}</td>
      <td>{formatWhole(sample.rate)}</td>
      <td>{formatWhole(sample.roof)}</td>
    </tr>
  );
}
