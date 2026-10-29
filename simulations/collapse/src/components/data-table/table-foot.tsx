import { formatWhole } from "../../model/erosion";

/**
 * The average row: a plain mean over every row in the trial, so sorting cannot change it. "Average:"
 * is the row's heading, in the years column, which has no average of its own.
 */
export function TableFoot({
  averageRate,
  averageRoof,
}: {
  averageRate: number;
  averageRoof: number;
}) {
  return (
    <tfoot>
      <tr className="collapse-foot">
        <td />
        <th scope="row">Average:</th>
        <td>{formatWhole(averageRate)}</td>
        <td>{formatWhole(averageRoof)}</td>
        <td />
      </tr>
    </tfoot>
  );
}
