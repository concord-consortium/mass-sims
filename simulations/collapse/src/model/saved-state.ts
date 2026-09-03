import type { AxisDef, ComboId, SampleRow, StatId } from "./sim";

/**
 * The shape persisted to / restored from Activity Player's `interactiveState`. Plain
 * JSON-serializable values only. Holds each environment's generated rows plus the shared
 * table/graph configuration; the in-progress "years before collapse" field is transient.
 * (Table columns and the graph's x axis are fixed, so they aren't persisted.)
 */
export interface SavedState {
  tables: Record<ComboId, SampleRow[]>;
  selectedCombo: ComboId;
  summaryStat: StatId;
  yAxis: AxisDef["id"];
}
