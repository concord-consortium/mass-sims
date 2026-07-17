import { Select, type SelectOption } from "@concord-consortium/mass-sims-shared";
import type { ReactNode } from "react";
import AirMassLandIcon from "../assets/icons/air-mass-land.svg?react";
import AirMassOceanIcon from "../assets/icons/air-mass-ocean.svg?react";
import HumidityDryIcon from "../assets/icons/humidity-dry.svg?react";
import HumidityHumidIcon from "../assets/icons/humidity-humid.svg?react";
import TempColdIcon from "../assets/icons/temp-cold.svg?react";
import TempWarmIcon from "../assets/icons/temp-warm.svg?react";
import { PathwayNumber } from "./icons/pathway-number";

import "./air-mass-selectors.scss";

// Every dropdown is inert: controlled `selectedKey={null}` with no `onSelectionChange`, so it stays
// at the "Select…" placeholder and choosing an option changes nothing. The Ocean Temperature cell is
// a static display (not a dropdown) showing an en-dash.

const PLACEHOLDER = "Select…";

interface NorOption {
  /** The option's stored value (also the visible text). */
  value: string;
  icon: ReactNode;
  /** Accessible name override — used for pathway options so the number reaches assistive tech. */
  textValue?: string;
}

/** Build the shared-Select option list: each label is `icon + text`; `textValue` sets the a11y name. */
function toSelectOptions(options: readonly NorOption[]): SelectOption<string>[] {
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

interface NorSelectProps {
  /** Accessible name of the field (visually hidden — the column header + row label show visually). */
  label: string;
  options: readonly NorOption[];
}

/** One inert air-mass dropdown, styled into the grid to match the demo's `.sim-dropdown`. */
function NorSelect({ label, options }: NorSelectProps) {
  return (
    <Select
      className="nor-select"
      label={label}
      options={toSelectOptions(options)}
      placeholder={PLACEHOLDER}
      selectedKey={null}
    />
  );
}

// Pathway → number map, NOT sequential with option order (N/NW→1, W→4, S/SE→2, NE→3). The circled
// number is decorative; the number reaches assistive tech via the option's textValue.
const LAND_PATHWAY: readonly NorOption[] = [
  { value: "N/NW", icon: <PathwayNumber num={1} />, textValue: "1 N/NW" },
  { value: "W", icon: <PathwayNumber num={4} />, textValue: "4 W" },
];
const OCEAN_PATHWAY: readonly NorOption[] = [
  { value: "S/SE", icon: <PathwayNumber num={2} />, textValue: "2 S/SE" },
  { value: "NE", icon: <PathwayNumber num={3} />, textValue: "3 NE" },
];
const HUMIDITY: readonly NorOption[] = [
  { value: "Dry", icon: <HumidityDryIcon /> },
  { value: "Humid", icon: <HumidityHumidIcon /> },
];
const LAND_TEMPERATURE: readonly NorOption[] = [
  { value: "Cold", icon: <TempColdIcon /> },
  { value: "Warm", icon: <TempWarmIcon /> },
];

// Temperature is rendered separately (below) with a short "Temp" variant for the condensed layout;
// these three always fit.
const COLUMN_HEADERS = ["", "Pathway", "Humidity"] as const;

/**
 * The Ocean Temperature display — a pill, not a dropdown; its value is derived from the ocean pathway.
 * Plain visible text with no `role="status"`/`aria-live`: per the a11y convention, sims carry zero
 * scattered live regions — any narration routes through the shared `<Announcer>`.
 */
function OceanTempDisplay() {
  return (
    <div className="nor-temp-display">
      <span className="nor-temp-display-label">–</span>
    </div>
  );
}

export function AirMassSelectors() {
  return (
    <div className="nor-air-mass-selectors">
      <div className="nor-controls-grid">
        {/* Row 1 — column headers (the first cell is intentionally blank, above the air-mass labels). */}
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

        {/* Row 2 — Land Air Mass. */}
        <div className="nor-air-mass">
          <span className="nor-air-mass-icon" aria-hidden="true">
            <AirMassLandIcon />
          </span>
          <span className="nor-air-mass-label">
            Land
            <br />
            Air Mass
          </span>
        </div>
        <NorSelect label="Pathway for Land Air Mass" options={LAND_PATHWAY} />
        <NorSelect label="Humidity for Land Air Mass" options={HUMIDITY} />
        <NorSelect label="Temperature for Land Air Mass" options={LAND_TEMPERATURE} />

        {/* Row 3 — Ocean Air Mass. Temperature is a derived static display, not a dropdown. */}
        <div className="nor-air-mass">
          <span className="nor-air-mass-icon" aria-hidden="true">
            <AirMassOceanIcon />
          </span>
          <span className="nor-air-mass-label">
            Ocean
            <br />
            Air Mass
          </span>
        </div>
        <NorSelect label="Pathway for Ocean Air Mass" options={OCEAN_PATHWAY} />
        <NorSelect label="Humidity for Ocean Air Mass" options={HUMIDITY} />
        <OceanTempDisplay />
      </div>
    </div>
  );
}
