import type { KeyboardEvent, MouseEvent } from "react";
import CloseIcon from "../../assets/close-icon.svg?react";
import { type Conditions, formatWhole, isCollapsed } from "../../model/erosion";
import type { Sample } from "../../model/types";
import { Thumbnail } from "./thumbnail";

export function sampleRowLabel({ years, rate, roof }: Sample): string {
  return (
    `Sample at ${formatWhole(years)} years before collapse, erosion rate ${formatWhole(rate)} mm ` +
    `per 1,000 years, rock above cave ${formatWhole(roof)} mm${isCollapsed(roof) ? ", collapsed" : ""}`
  );
}

interface SampleRowProps {
  sample: Sample;
  conditions: Conditions;
  /** `${letter}:${id}`: ids are unique only within a trial. */
  rowKey: string;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

/**
 * One sample. The row is a tab stop with its own label, and Enter or Space selects it, as a click
 * does. Rows use `aria-current`, not `aria-selected`, which only means something in a grid,
 * listbox or tree. The delete button is a separate tab stop.
 */
export function SampleRow({
  sample,
  conditions,
  rowKey,
  selected,
  onSelect,
  onDelete,
}: SampleRowProps) {
  const collapsed = isCollapsed(sample.roof);

  const onKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    // Only on the row itself: on the delete button, Space and Enter are the button's own.
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  const onDeleteClick = (e: MouseEvent<HTMLButtonElement>) => {
    // Deleting is not selecting.
    e.stopPropagation();
    onDelete();
  };

  return (
    // No `className`: the keyboard hook writes this row's classes (`kb-focus`), and a React-owned
    // class would overwrite them when the selection changes. The selected style keys off
    // `aria-current`.
    <tr
      tabIndex={0}
      aria-label={sampleRowLabel(sample)}
      aria-current={selected ? "true" : undefined}
      data-row-key={rowKey}
      onClick={onSelect}
      onKeyDown={onKeyDown}
    >
      <td className="collapse-cell-pic">
        <Thumbnail conditions={conditions} years={sample.years} />
      </td>
      <td>{formatWhole(sample.years)}</td>
      <td>{formatWhole(sample.rate)}</td>
      {collapsed ? (
        <td className="collapse-cell-failed">
          collapsed
          <br />({formatWhole(sample.roof)})
        </td>
      ) : (
        <td>{formatWhole(sample.roof)}</td>
      )}
      <td className="collapse-cell-del">
        <button
          type="button"
          className="collapse-row-del"
          aria-label={`Delete the sample at ${formatWhole(sample.years)} years before collapse`}
          onClick={onDeleteClick}
        >
          <CloseIcon aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
}
