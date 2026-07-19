import { Select, type SelectOption, useAnnounce } from "@concord-consortium/mass-sims-shared";
import { observer } from "mobx-react-lite";
import type { ReactNode } from "react";
import AirMassLandIcon from "../assets/icons/air-mass-land.svg?react";
import AirMassOceanIcon from "../assets/icons/air-mass-ocean.svg?react";
import HumidityDryIcon from "../assets/icons/humidity-dry.svg?react";
import HumidityHumidIcon from "../assets/icons/humidity-humid.svg?react";
import TempColdIcon from "../assets/icons/temp-cold.svg?react";
import TempCoolIcon from "../assets/icons/temp-cool.svg?react";
import TempWarmIcon from "../assets/icons/temp-warm.svg?react";
import type {
  Humidity,
  LandPathway,
  LandTemperature,
  OceanPathway,
  OceanTemperature,
} from "../model/weather";
import { useStores } from "../stores/root-store";
import { PathwayNumber } from "./icons/pathway-number";
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

// Pathway → number map, NOT sequential with option order (N/NW→1, W→4, S/SE→2, NE→3). The circled
// number is decorative; the number reaches assistive tech via the option's textValue.
const LAND_PATHWAY: readonly NorOption<LandPathway>[] = [
  { value: "N/NW", icon: <PathwayNumber num={1} />, textValue: "1 N/NW" },
  { value: "W", icon: <PathwayNumber num={4} />, textValue: "4 W" },
];
const OCEAN_PATHWAY: readonly NorOption<OceanPathway>[] = [
  { value: "S/SE", icon: <PathwayNumber num={2} />, textValue: "2 S/SE" },
  { value: "NE", icon: <PathwayNumber num={3} />, textValue: "3 NE" },
];
const HUMIDITY: readonly NorOption<Humidity>[] = [
  { value: "Dry", icon: <HumidityDryIcon /> },
  { value: "Humid", icon: <HumidityHumidIcon /> },
];
const LAND_TEMPERATURE: readonly NorOption<LandTemperature>[] = [
  { value: "Cold", icon: <TempColdIcon /> },
  { value: "Warm", icon: <TempWarmIcon /> },
];
const OCEAN_TEMP_ICON: Record<OceanTemperature, ReactNode> = {
  Warm: <TempWarmIcon />,
  Cool: <TempCoolIcon />,
};

// Column headers (the first is blank, above the air-mass labels). Temperature is rendered separately
// (below) so it can swap to a short "Temp" variant in the condensed layout.
const COLUMN_HEADERS = ["", "Pathway", "Humidity"] as const;
const COL_INDEX = { pathway: 0, humidity: 1, temperature: 2 } as const;
type Attribute = keyof typeof COL_INDEX;

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
}: {
  label: string;
  value: string | null;
  icon?: ReactNode;
  /** Grid column (0–2) — selects the per-column icon↔value gap via the `.nor-col-N` alias. */
  col: 0 | 1 | 2;
}) {
  return (
    <div className={`nor-value-pill nor-col-${col}`}>
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
  if (locked) {
    const icon = value !== null ? options.find((o) => o.value === value)?.icon : undefined;
    return <NorValuePill label={label} value={value} icon={icon} col={col} />;
  }
  return (
    <Select
      className={`nor-select nor-col-${col}${value === null ? " nor-placeholder" : ""}`}
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
  const locked = trial.locked;

  // The Ocean pathway is the only selection with a derived consequence (the non-editable Ocean
  // Temperature). Announce that derived value through the shared <Announcer> so it isn't a silent
  // visual-only change (matches the demo's updateOceanTemp narration).
  const setOceanPathway = (value: OceanPathway) => {
    trial.setOceanPathway(value);
    announce(`Temperature for Ocean Air Mass: ${trial.oceanTemperature}`);
  };

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
            <AirMassLandIcon />
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
          onChange={trial.setLandPathway}
          locked={locked}
          airMass="land"
          attribute="pathway"
          trial={letter}
        />
        <SelectorCell
          label="Humidity for Land Air Mass"
          options={HUMIDITY}
          value={trial.landHumidity}
          onChange={trial.setLandHumidity}
          locked={locked}
          airMass="land"
          attribute="humidity"
          trial={letter}
        />
        <SelectorCell
          label="Temperature for Land Air Mass"
          options={LAND_TEMPERATURE}
          value={trial.landTemperature}
          onChange={trial.setLandTemperature}
          locked={locked}
          airMass="land"
          attribute="temperature"
          trial={letter}
        />

        {/* Row 3 — Ocean Air Mass. Temperature is a derived read-only pill, not a dropdown. */}
        <div className="nor-air-mass">
          <span
            className="nor-air-mass-icon"
            data-tint={tempTint(trial.oceanTemperature)}
            aria-hidden="true"
          >
            <AirMassOceanIcon />
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
          onChange={trial.setOceanHumidity}
          locked={locked}
          airMass="ocean"
          attribute="humidity"
          trial={letter}
        />
        <NorValuePill
          label="Temperature for Ocean Air Mass"
          value={trial.oceanTemperature}
          icon={
            trial.oceanTemperature !== null ? OCEAN_TEMP_ICON[trial.oceanTemperature] : undefined
          }
          col={2}
        />
      </div>
    </div>
  );
});
