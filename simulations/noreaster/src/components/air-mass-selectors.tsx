import { Select, type SelectOption, useAnnounce } from "@concord-consortium/mass-sims-shared";
import { observer } from "mobx-react-lite";
import type { CSSProperties, ReactNode } from "react";
import {
  HUMIDITIES,
  type Humidity,
  LAND_PATHWAYS,
  LAND_TEMPERATURES,
  type LandPathway,
  type LandTemperature,
  OCEAN_PATHWAYS,
  type OceanPathway,
} from "../model/weather";
import { useStores } from "../stores/root-store";
import {
  airMassIcon,
  humidityIcon,
  PATHWAY_NUMBER,
  pathwayNumber,
  tempIcon,
} from "./icons/air-mass-icons";
import { tempTint } from "./selection-tint";

import "./air-mass-selectors.scss";

const PLACEHOLDER = "Select…";

interface NorOption<K extends string> {
  /** The option's stored value (also the visible text). */
  value: K;
  icon: ReactNode;
  /** Accessible name override — used for pathway options so the number reaches assistive tech. */
  textValue?: string;
}

/** Build the shared-Select option list: each label is `icon + text`; `textValue` sets the a11y name. */
function toSelectOptions<K extends string>(options: readonly NorOption<K>[]): SelectOption<K>[] {
  return options.map(({ value, icon, textValue }) => ({
    id: value,
    label: (
      <>
        <span className="nor-dd-icon" aria-hidden="true">
          {icon}
        </span>
        <span>{value}</span>
      </>
    ),
    textValue,
  }));
}

// Option lists are built from the shared value→icon module (icons/air-mass-icons) so there's one
// source for every mapping. The pathway number is non-sequential with the option order (N/NW→1, W→4,
// S/SE→2, NE→3); the circled number is decorative, so it reaches assistive tech via the `textValue`.
const LAND_PATHWAY: readonly NorOption<LandPathway>[] = LAND_PATHWAYS.map((value) => ({
  value,
  icon: pathwayNumber(value),
  textValue: `${PATHWAY_NUMBER[value]} ${value}`,
}));
const OCEAN_PATHWAY: readonly NorOption<OceanPathway>[] = OCEAN_PATHWAYS.map((value) => ({
  value,
  icon: pathwayNumber(value),
  textValue: `${PATHWAY_NUMBER[value]} ${value}`,
}));
const HUMIDITY: readonly NorOption<Humidity>[] = HUMIDITIES.map((value) => ({
  value,
  icon: humidityIcon(value),
}));
const LAND_TEMPERATURE: readonly NorOption<LandTemperature>[] = LAND_TEMPERATURES.map((value) => ({
  value,
  icon: tempIcon(value),
}));

// Column headers (the first is blank, above the air-mass labels). Temperature is rendered separately
// (below) so it can swap to a short "Temp" variant in the condensed layout.
const COLUMN_HEADERS = ["", "Pathway", "Humidity"] as const;
const COL_INDEX = { pathway: 0, humidity: 1, temperature: 2 } as const;
type Attribute = keyof typeof COL_INDEX;

/**
 * Leftward nudge (px) for a value pill's icon+label. Per column: Temperature → 3, Humidity Dry → 2 /
 * Humid → 1, Pathway → 0; a valueless `–` pill stays centered. Applied as asymmetric L/R padding around
 * `--nor-pad-r` in the scss.
 */
export function pillShift(col: 0 | 1 | 2, value: string | null): number {
  if (value === null) return 0;
  if (col === 2) return 3;
  if (col === 1) return value === "Dry" ? 2 : value === "Humid" ? 1 : 0;
  return 0;
}

/**
 * A read-only value pill (icon + value) — used for a locked selector after a run and for the derived
 * Ocean Temperature. `value === null` shows the `–` placeholder (no icon). The accessible name pairs
 * the field label with the value ("Humidity for Ocean Air Mass: Humid") via an sr-only span, so a
 * screen reader keeps the field context the dropdown's label used to carry; the visible icon + text
 * are decorative.
 */
function NorValuePill({
  label,
  value,
  icon,
  col,
  ocean,
}: {
  label: string;
  value: string | null;
  icon?: ReactNode;
  /** Grid column (0–2) — selects the per-column icon↔value gap via the `.nor-col-N` alias. */
  col: 0 | 1 | 2;
  ocean?: boolean;
}) {
  return (
    <div
      className={`nor-value-pill nor-col-${col}${ocean ? " nor-row-ocean" : ""}`}
      style={{ "--nor-pill-shift": pillShift(col, value) } as CSSProperties}
    >
      <span className="sr-only">{value === null ? label : `${label}: ${value}`}</span>
      {value !== null && icon ? (
        <span className="nor-dd-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="nor-value-pill-label" aria-hidden="true">
        {value ?? "–"}
      </span>
    </div>
  );
}

interface SelectorCellProps<K extends string> {
  /** Accessible name of the field (visually hidden — the column header + row label show visually). */
  label: string;
  options: readonly NorOption<K>[];
  value: K | null;
  onChange: (value: K) => void;
  locked: boolean;
  airMass: "land" | "ocean";
  attribute: Attribute;
  trial: string;
}

/** One air-mass field: a shared `<Select>` while editable, a read-only pill once the trial is run. */
function SelectorCell<K extends string>({
  label,
  options,
  value,
  onChange,
  locked,
  airMass,
  attribute,
  trial,
}: SelectorCellProps<K>) {
  const col = COL_INDEX[attribute];
  const ocean = airMass === "ocean";
  if (locked) {
    const icon = value !== null ? options.find((o) => o.value === value)?.icon : undefined;
    return <NorValuePill label={label} value={value} icon={icon} col={col} ocean={ocean} />;
  }
  return (
    <Select
      className={`nor-select nor-col-${col}${value === null ? " nor-placeholder" : ""}${ocean ? " nor-row-ocean" : ""}`}
      label={label}
      options={toSelectOptions(options)}
      placeholder={PLACEHOLDER}
      selectedKey={value}
      onSelectionChange={onChange}
      action="air_mass_selected"
      actionParams={{ trial, airMass, attribute }}
    />
  );
}

export const AirMassSelectors = observer(function AirMassSelectors() {
  const { activeTrial: trial, ui } = useStores();
  const announce = useAnnounce();
  const letter = ui.selectedTrialLetter;
  // Lock to read-only pills once the trial is run, or while its run animation is in flight — the outcome
  // isn't recorded yet mid-run, so `trial.locked` alone wouldn't cover the running phase.
  const locked = trial.locked || ui.isRunning(letter);

  // Announce the incomplete → complete transition once (any of the five selectors can be the one that
  // completes the setup), so a screen-reader user learns the setup is ready to run without navigating
  // back to the now-enabled Run button. The <Announcer> enqueues, so on the ocean pathway this plays
  // after that field's derived-temperature line.
  const announceSetup =
    <K,>(setter: (value: K) => void) =>
    (value: K) => {
      const wasComplete = trial.setupComplete;
      setter(value);
      if (!wasComplete && trial.setupComplete) {
        announce("Air masses set up. Run to see if a nor’easter forms.");
      }
    };

  // The Ocean pathway is the only selection with a derived consequence (the non-editable Ocean
  // Temperature); announce that derived value too (matches the demo's updateOceanTemp narration).
  const setOceanPathway = announceSetup((value: OceanPathway) => {
    trial.setOceanPathway(value);
    announce(`Temperature for Ocean Air Mass: ${trial.oceanTemperature}`);
  });

  return (
    <div className="nor-air-mass-selectors">
      <div className="nor-controls-grid">
        {/* Row 1 — column headers. */}
        {COLUMN_HEADERS.map((text, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed, order-stable header list
            key={i}
            className="nor-col-header"
          >
            {text}
          </div>
        ))}
        <div className="nor-col-header">
          <span className="nor-col-header-full">Temperature</span>
          <span className="nor-col-header-short">Temp</span>
        </div>

        {/* Row 2 — Land Air Mass. The row icon tints by the selected land temperature. */}
        <div className="nor-air-mass">
          <span
            className="nor-air-mass-icon"
            data-tint={tempTint(trial.landTemperature)}
            aria-hidden="true"
          >
            {airMassIcon("land")}
          </span>
          <span className="nor-air-mass-label">
            Land
            <br />
            Air Mass
          </span>
        </div>
        <SelectorCell
          label="Pathway for Land Air Mass"
          options={LAND_PATHWAY}
          value={trial.landPathway}
          onChange={announceSetup(trial.setLandPathway)}
          locked={locked}
          airMass="land"
          attribute="pathway"
          trial={letter}
        />
        <SelectorCell
          label="Humidity for Land Air Mass"
          options={HUMIDITY}
          value={trial.landHumidity}
          onChange={announceSetup(trial.setLandHumidity)}
          locked={locked}
          airMass="land"
          attribute="humidity"
          trial={letter}
        />
        <SelectorCell
          label="Temperature for Land Air Mass"
          options={LAND_TEMPERATURE}
          value={trial.landTemperature}
          onChange={announceSetup(trial.setLandTemperature)}
          locked={locked}
          airMass="land"
          attribute="temperature"
          trial={letter}
        />

        {/* Row 3 — Ocean Air Mass. Temperature is a derived read-only pill, not a dropdown. */}
        <div className="nor-air-mass nor-row-ocean">
          <span
            className="nor-air-mass-icon"
            data-tint={tempTint(trial.oceanTemperature)}
            aria-hidden="true"
          >
            {airMassIcon("ocean")}
          </span>
          <span className="nor-air-mass-label">
            Ocean
            <br />
            Air Mass
          </span>
        </div>
        <SelectorCell
          label="Pathway for Ocean Air Mass"
          options={OCEAN_PATHWAY}
          value={trial.oceanPathway}
          onChange={setOceanPathway}
          locked={locked}
          airMass="ocean"
          attribute="pathway"
          trial={letter}
        />
        <SelectorCell
          label="Humidity for Ocean Air Mass"
          options={HUMIDITY}
          value={trial.oceanHumidity}
          onChange={announceSetup(trial.setOceanHumidity)}
          locked={locked}
          airMass="ocean"
          attribute="humidity"
          trial={letter}
        />
        <NorValuePill
          label="Temperature for Ocean Air Mass"
          value={trial.oceanTemperature}
          icon={trial.oceanTemperature !== null ? tempIcon(trial.oceanTemperature) : undefined}
          col={2}
          ocean
        />
      </div>
    </div>
  );
});
