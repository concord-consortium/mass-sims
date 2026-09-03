import { LineChart, Select } from "@concord-consortium/mass-sims-shared";
import { AXES, type AxisDef, FIXED_COLUMN_IDS, type SampleRow } from "../model/sim";
import "./graph.scss";

interface GraphProps {
  rows: SampleRow[];
  yAxis: AxisDef["id"];
  onChangeYAxis: (id: AxisDef["id"]) => void;
  selectedRow: SampleRow | null;
}

// The x axis is fixed to "Years before collapse"; the y axis picks from the three fixed columns only.
const X_AXIS = AXES.find((a) => a.id === "yearsBeforeCollapse") ?? AXES[0];
const yAxisOptions = FIXED_COLUMN_IDS.map((id) => {
  const a = AXES.find((ax) => ax.id === id);
  return { id, label: a?.label ?? id };
});

export function Graph({ rows, yAxis, onChangeYAxis, selectedRow }: GraphProps) {
  const x = X_AXIS;
  const y =
    AXES.find((a) => a.id === yAxis) ?? AXES.find((a) => a.id === FIXED_COLUMN_IDS[0]) ?? AXES[1];
  // Flatten each row to a plain {axisId: value} point (LineChart needs an
  // index-signature type), sorted ascending by the x axis.
  const data: Record<string, number>[] = [...rows]
    .sort((a, b) => x.get(a) - x.get(b))
    .map((r) => Object.fromEntries(AXES.map((a) => [a.id, a.get(r)])));

  return (
    <div className="graph">
      <div className="axis-picker axis-y">
        <Select
          options={yAxisOptions}
          selectedKey={yAxis}
          onSelectionChange={(k) => onChangeYAxis(k as AxisDef["id"])}
        />
      </div>
      <LineChart
        data={data}
        xKey={x.id}
        yKey={y.id}
        height={140}
        xLabel={x.unit || undefined}
        yLabel={y.unit || undefined}
        xReversed={x.id === "yearsBeforeCollapse"}
        yReversed={y.id === "yearsBeforeCollapse"}
        highlightX={selectedRow ? x.get(selectedRow) : undefined}
        highlightY={selectedRow ? y.get(selectedRow) : undefined}
        ariaLabel={`${y.label} vs ${x.label}`}
        emptyState={<span className="graph-empty">Add data points to plot.</span>}
      />
      <div className="axis-picker axis-x">
        <span className="axis-fixed-label">{x.label}</span>
      </div>
    </div>
  );
}
