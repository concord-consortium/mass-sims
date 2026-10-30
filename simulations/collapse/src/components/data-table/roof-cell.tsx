import { formatWhole, isCollapsed } from "../../model/erosion";

/** The rock above the cave. Where the roof gave way: "collapsed" over the number, on two lines. */
export function RoofCell({ roof }: { roof: number }) {
  if (!isCollapsed(roof)) return <td>{formatWhole(roof)}</td>;
  return (
    <td className="collapse-cell-failed">
      collapsed
      <br />({formatWhole(roof)})
    </td>
  );
}
