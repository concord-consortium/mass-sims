import { setInteractiveState, useInitMessage } from "@concord-consortium/lara-interactive-api";
import { Button, SimulationFrame, TrialCard } from "@concord-consortium/mass-sims-shared";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { DataTable } from "./components/data-table";
import { Graph } from "./components/graph";
import { RowDetail } from "./components/row-detail";
import { Timeline } from "./components/timeline";
import type { SavedState } from "./model/saved-state";
import {
  type AxisDef,
  COLLAPSE_SPAN_YEARS,
  COMBOS,
  type ComboId,
  comboById,
  DEFAULT_YEARS_BEFORE,
  generateRow,
  type SampleRow,
  type StatId,
  stepSampleYear,
  TERRAIN_META,
  WEATHER_META,
  weatherDefinition,
} from "./model/sim";

import "./app.scss";

interface AppState {
  tables: Record<ComboId, SampleRow[]>;
  selectedCombo: ComboId;
  summaryStat: StatId;
  yAxis: AxisDef["id"];
}

const emptyTables = (): Record<ComboId, SampleRow[]> => ({
  "limestone-wet": [],
  "limestone-dry": [],
  "granite-wet": [],
  "granite-dry": [],
});

const INITIAL: AppState = {
  tables: emptyTables(),
  selectedCombo: "limestone-wet",
  summaryStat: "average",
  yAxis: "erosionRate",
};

/** A button that fires `onStep` once on press, then repeats while held (press-and-hold). */
function HoldButton({
  onStep,
  disabled,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  onStep: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
    if (intervalRef.current != null) window.clearInterval(intervalRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (disabled) return;
    onStep();
    // Short pause before auto-repeat kicks in, then step steadily.
    timeoutRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(onStep, 70);
    }, 350);
  }, [disabled, onStep]);

  // Stop if the button disables mid-hold (hit a bound) or the component unmounts.
  useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);
  useEffect(() => stop, [stop]);

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        e.preventDefault();
        start();
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
    >
      {children}
    </button>
  );
}

/**
 * Collapse — a data-generation sim. Four environments (terrain × weather) each get their own table.
 * The Simulation pane is the timeline + a sample control, then the selected experiment's table
 * with fixed columns (erosion rate, dissolved rock, total depth); the graph lives in the Data pane.
 */
export function App() {
  const [state, setState] = useState<AppState>(INITIAL);
  const [yearsBefore, setYearsBefore] = useState<number>(DEFAULT_YEARS_BEFORE);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  const { tables, selectedCombo, summaryStat, yAxis } = state;
  const rows = tables[selectedCombo];
  // Selection is validated against the current table, so switching zones, deleting, or resetting
  // a row all clear the detail/highlight for free (the id simply isn't found).
  const selectedRow = rows.find((r) => r.id === selectedRowId) ?? null;
  const combo = comboById(selectedCombo);
  const clampYear = (y: number) => Math.max(0, Math.min(COLLAPSE_SPAN_YEARS, y));

  const initMsg = useInitMessage<SavedState>();
  useEffect(() => {
    if (initMsg && "interactiveState" in initMsg && initMsg.interactiveState) {
      setState((prev) => ({ ...prev, ...initMsg.interactiveState }));
    }
  }, [initMsg]);
  useEffect(() => {
    setInteractiveState<SavedState>({ tables, selectedCombo, summaryStat, yAxis });
  }, [tables, selectedCombo, summaryStat, yAxis]);

  const sample = useCallback(() => {
    setState((prev) => {
      const row = generateRow(prev.selectedCombo, yearsBefore);
      return {
        ...prev,
        tables: { ...prev.tables, [prev.selectedCombo]: [...prev.tables[prev.selectedCombo], row] },
      };
    });
  }, [yearsBefore]);

  const resetZone = useCallback((id: ComboId) => {
    setState((prev) => ({ ...prev, tables: { ...prev.tables, [id]: [] } }));
  }, []);

  const deleteRow = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      tables: {
        ...prev.tables,
        [prev.selectedCombo]: prev.tables[prev.selectedCombo].filter((r) => r.id !== id),
      },
    }));
  }, []);

  const patch = useCallback((p: Partial<AppState>) => setState((prev) => ({ ...prev, ...p })), []);

  return (
    <SimulationFrame
      simTitle="Collapse"
      tagline="Sample deep time to see how caves and karst form"
      infoModalContent={
        <p>
          Each environment — a terrain (limestone or granite) and a weather (wet or dry) — has its
          own data table. Pick one, choose how many years before the collapse to sample, and add a
          row. Each row records the erosion rate, dissolved rock, and total depth; pick a summary
          statistic and build a graph to compare the environments.
        </p>
      }
    >
      <SimulationFrame.Trials title="Zone">
        {COMBOS.map((c, i) => (
          <TrialCard
            key={c.id}
            index={i}
            selected={c.id === selectedCombo}
            onSelect={() => patch({ selectedCombo: c.id })}
            onReset={() => resetZone(c.id)}
            resetDisabled={tables[c.id].length === 0}
          >
            <span className="zone-row">
              <span className="zone-icon" aria-hidden="true">
                {TERRAIN_META[c.terrain].icon}
              </span>
              <span className="zone-label">{TERRAIN_META[c.terrain].label}</span>
            </span>
            <span className="zone-row">
              <span className="zone-icon" aria-hidden="true">
                {WEATHER_META[c.weather].icon}
              </span>
              <span className="zone-label">{WEATHER_META[c.weather].label}</span>
            </span>
            <span className="table-card-count">
              {tables[c.id].length} {tables[c.id].length === 1 ? "time sampled" : "times sampled"}
            </span>
          </TrialCard>
        ))}
      </SimulationFrame.Trials>

      <SimulationFrame.Simulation instruction="Choose a zone and sample through time">
        <div className="sim-body">
          <Timeline sampledYear={yearsBefore} onScrub={(y) => setYearsBefore(clampYear(y))} />

          <div className="sampler-row">
            <div className="year-control">
              <span className="year-label">
                Years before
                <br />
                Collapse
              </span>
              {/* Arrows follow the timeline: ← moves back in time (more years before collapse), → forward. */}
              <div className="year-stepper">
                <HoldButton
                  className="year-arrow"
                  aria-label="Earlier — more years before collapse"
                  disabled={yearsBefore >= COLLAPSE_SPAN_YEARS}
                  onStep={() => setYearsBefore((y) => stepSampleYear(y, 1))}
                >
                  ◀
                </HoldButton>
                <input
                  type="number"
                  className="year-input"
                  aria-label="Years before collapse"
                  min={0}
                  max={COLLAPSE_SPAN_YEARS}
                  step={1}
                  value={yearsBefore}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isNaN(v)) setYearsBefore(clampYear(v));
                  }}
                />
                <HoldButton
                  className="year-arrow"
                  aria-label="Later — fewer years before collapse"
                  disabled={yearsBefore <= 0}
                  onStep={() => setYearsBefore((y) => stepSampleYear(y, -1))}
                >
                  ▶
                </HoldButton>
              </div>
            </div>
            <Button onPress={sample}>Sample</Button>

            <div className="zone-desc">
              <span className="zone-row">
                <span className="zone-icon" aria-hidden="true">
                  {TERRAIN_META[combo.terrain].icon}
                </span>
                <span className="zone-label">{TERRAIN_META[combo.terrain].label}</span>
              </span>
              <span className="zone-row">
                <span className="zone-icon" aria-hidden="true">
                  {WEATHER_META[combo.weather].icon}
                </span>
                <span className="zone-label">{WEATHER_META[combo.weather].label}</span>
                <span className="combo-def">{weatherDefinition(combo.weather)}</span>
              </span>
            </div>
          </div>

          <div className="table-area">
            <DataTable
              rows={rows}
              summaryStat={summaryStat}
              onChangeSummaryStat={(s) => patch({ summaryStat: s })}
              onDeleteRow={deleteRow}
              selectedRowId={selectedRow?.id ?? null}
              onSelectRow={setSelectedRowId}
            />
          </div>
        </div>
      </SimulationFrame.Simulation>

      <SimulationFrame.Data>
        <div className="data-pane">
          <Graph
            rows={rows}
            yAxis={yAxis}
            onChangeYAxis={(id) => patch({ yAxis: id })}
            selectedRow={selectedRow}
          />
          <RowDetail row={selectedRow} />
        </div>
      </SimulationFrame.Data>
    </SimulationFrame>
  );
}
