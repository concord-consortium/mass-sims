import { LineChart, Select } from "@concord-consortium/mass-sims-shared";
import { AXES, type AxisDef, type SampleRow } from "../model/sim";
import "./graph.scss";

interface GraphProps {
  rows: SampleRow[];
  xAxis: AxisDef["id"];
  yAxis: AxisDef["id"];
  onChangeXAxis: (id: AxisDef["id"]) => void;
  onChangeYAxis: (id: AxisDef["id"]) => void;
  selectedRow: SampleRow | null;
}

const axisOptions = AXES.map((a) => ({ id: a.id, label: a.label }));

export function Graph({
  rows,
  xAxis,
  yAxis,
  onChangeXAxis,
  onChangeYAxis,
  selectedRow,
}: GraphProps) {
  const x = AXES.find((a) => a.id === xAxis) ?? AXES[0];
  const y = AXES.find((a) => a.id === yAxis) ?? AXES[1];
  // Flatten each row to a plain {axisId: value} point (LineChart needs an
  // index-signature type), sorted ascending by the x axis.
  const data: Record<string, number>[] = [...rows]
    .sort((a, b) => x.get(a) - x.get(b))
    .map((r) => Object.fromEntries(AXES.map((a) => [a.id, a.get(r)])));

  return (
    <div className="graph">
      <div className="axis-picker axis-y">
        <Select
          options={axisOptions}
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
        <Select
          options={axisOptions}
          selectedKey={xAxis}
          onSelectionChange={(k) => onChangeXAxis(k as AxisDef["id"])}
        />
      </div>
    </div>
  );
}
