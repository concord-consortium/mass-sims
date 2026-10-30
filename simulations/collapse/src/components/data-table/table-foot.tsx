import { formatWhole } from "../../model/erosion";

/**
 * The average row: a plain mean over every row in the trial, so sorting cannot change it. "Average:"
 * is the row's heading, in the years column, which has no average of its own. `trailingCell` is the
 * empty cell under the delete column.
 */
export function TableFoot({
  averageRate,
  averageRoof,
  trailingCell = true,
}: {
  averageRate: number;
  averageRoof: number;
  trailingCell?: boolean;
}) {
  return (
    <tfoot>
      <tr className="collapse-foot">
        <td />
        <th scope="row">Average:</th>
        <td>{formatWhole(averageRate)}</td>
        <td>{formatWhole(averageRoof)}</td>
        {trailingCell && <td />}
      </tr>
    </tfoot>
  );
}
