import { DataSubsection } from "@concord-consortium/mass-sims-shared";
import { observer } from "mobx-react-lite";
import { type ReactNode, useRef } from "react";
import { OUTCOME_VALUES, type OutcomeValues } from "../model/outcome-values";
import { useStores } from "../stores/root-store";
import { WeatherIcon } from "./icons/weather-icons";
import { OUTCOME_ICONS, type WeatherIconSet } from "./outcome-icons";
import { useCondensedLabels } from "./use-condensed-labels";

import "./data-panel.scss";

/**
 * Nor'easter Data panel — the "Weather Outcome" table, wired to the active trial's recorded outcome.
 *
 * Empty/default state (no recorded outcome — an unrun or freshly-reset trial): the pill and every value
 * show the en-dash placeholder and each icon slot is the stand-in disc. Once the trial has a recorded
 * outcome, the pill shows its banner and each row shows the outcome's value + weather icon (from the
 * model's `OUTCOME_VALUES` and the presentation `OUTCOME_ICONS`, both keyed by outcome). Clearing on
 * Reset Trial / on selecting an unrun trial is automatic — the panel is an `observer` on
 * `activeTrial.outcome`, so it re-renders to the empty branch when the outcome goes back to `null`.
 *
 * The heading comes from the shared `<DataSubsection>` (a real `<h3>` "Weather Outcome" under the Data
 * region's `<h2>`), matching the bananas Data panel's composition.
 */

const PLACEHOLDER = "–";
const TITLE = "Weather Outcome";

/**
 * One attribute row. `value`/`icon` are thunks that read this row's data from the outcome's value/icon
 * sets — each `icon` thunk names a literal icon family + key, so the pairing is type-checked per row.
 * `short` is the condensed label shown when the full one would wrap the value; the row keeps the full
 * `label` as its accessible name.
 */
interface AttributeRow {
  label: string;
  short?: string;
  value: (values: OutcomeValues) => string;
  icon: (icons: WeatherIconSet) => ReactNode;
}

const WEATHER_ATTRIBUTES: readonly AttributeRow[] = [
  { label: "Sky", value: (v) => v.sky, icon: (i) => <WeatherIcon family="sky" icon={i.sky} /> },
  {
    label: "Pressure",
    value: (v) => v.pressure,
    icon: (i) => <WeatherIcon family="pressure" icon={i.pressure} />,
  },
  { label: "Wind", value: (v) => v.wind, icon: (i) => <WeatherIcon family="wind" icon={i.wind} /> },
  {
    label: "Precipitation Type",
    short: "Precip Type",
    value: (v) => v.precipType,
    icon: (i) => <WeatherIcon family="precipType" icon={i.precipType} />,
  },
  {
    label: "Precipitation Amount",
    short: "Precip Amount",
    value: (v) => v.precipAmount,
    icon: (i) => <WeatherIcon family="precipAmount" icon={i.precipAmount} />,
  },
  {
    label: "Storm Intensity",
    value: (v) => v.stormIntensity,
    // The Storm Intensity row reads the `storm` icon family (the one field↔family divergence).
    icon: (i) => <WeatherIcon family="storm" icon={i.stormIntensity} />,
  },
];

export const NoreasterDataPanel = observer(function NoreasterDataPanel() {
  const { activeTrial } = useStores();
  const outcome = activeTrial.outcome;
  const values = outcome ? OUTCOME_VALUES[outcome] : null;
  const icons = outcome ? OUTCOME_ICONS[outcome] : null;
  const panelRef = useRef<HTMLDivElement>(null);
  useCondensedLabels(panelRef, outcome);

  return (
    <div className="noreaster-data-panel" ref={panelRef}>
      <DataSubsection title={TITLE}>
        {/* Outcome pill — the banner once run (bold, condensed at narrow widths), else the placeholder. */}
        <div className={`wo-pill${values ? " wo-pill--filled" : ""}`}>
          {values ? values.label : PLACEHOLDER}
        </div>
        <dl className="wo-table">
          {WEATHER_ATTRIBUTES.map(({ label, short, value, icon }) => (
            <div className="wo-row" key={label}>
              {/* Condensable rows name the term by its FULL label (aria-label) with both visible spans
                  aria-hidden, so swapping the visible text doesn't change what assistive tech reads.
                  Simple rows name themselves from their text. */}
              <dt className="wo-row-header" {...(short ? { "aria-label": label } : {})}>
                {/* Stand-in disc when empty; the real weather SVG (which clears the disc) once run. */}
                <span className={`wo-icon${icons ? " wo-icon--filled" : ""}`} aria-hidden="true">
                  {icons ? icon(icons) : null}
                </span>
                {short ? (
                  <span className="wo-label" aria-hidden="true">
                    <span className="wo-label-full">{label}</span>
                    <span className="wo-label-short">{short}</span>
                  </span>
                ) : (
                  <span className="wo-label">{label}</span>
                )}
              </dt>
              <dd className="wo-value">{values ? value(values) : PLACEHOLDER}</dd>
            </div>
          ))}
        </dl>
      </DataSubsection>
    </div>
  );
});
