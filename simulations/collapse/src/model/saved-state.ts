import type { AxisDef, ColumnId, ComboId, SampleRow, StatId } from "./sim";

/**
 * The shape persisted to / restored from Activity Player's `interactiveState`. Plain
 * JSON-serializable values only. Holds each environment's generated rows plus the shared
 * table/graph configuration; the in-progress "years before collapse" field is transient.
 */
export interface SavedState {
  tables: Record<ComboId, SampleRow[]>;
  selectedCombo: ComboId;
  selectedColumns: ColumnId[];
  summaryStat: StatId;
  xAxis: AxisDef["id"];
  yAxis: AxisDef["id"];
}
