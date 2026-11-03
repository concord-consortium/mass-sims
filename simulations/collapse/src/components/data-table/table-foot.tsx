import { formatWhole } from "../../model/erosion";

/**
 * The average row: a plain mean over every row in the trial, so sorting cannot change it. "Average:"
 * is the row's heading, in the years column, which has no average of its own. `headingOverPicture`
 * spans it over the picture column too, for a years column too narrow to hold it. `trailingCell`
 * is the empty cell under the delete column.
 */
export function TableFoot({
  averageRate,
  averageRoof,
  headingOverPicture = false,
  trailingCell = true,
}: {
  averageRate: number;
  averageRoof: number;
  headingOverPicture?: boolean;
  trailingCell?: boolean;
}) {
  return (
    <tfoot>
      <tr className="collapse-foot">
        {headingOverPicture ? (
          <th scope="row" colSpan={2}>
            Average:
          </th>
        ) : (
          <>
            <td />
            <th scope="row">Average:</th>
          </>
        )}
        <td>{formatWhole(averageRate)}</td>
        <td>{formatWhole(averageRoof)}</td>
        {trailingCell && <td />}
      </tr>
    </tfoot>
  );
}
