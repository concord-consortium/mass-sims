import { DataSubsection } from "@concord-consortium/mass-sims-shared";

import "./data-panel.scss";

/**
 * Nor'easter Data panel — the static "Weather Outcome" layout.
 *
 * Presentation only: an outcome "pill" (empty-state placeholder) over a six-row attribute table
 * (Sky / Pressure / Wind / Precipitation Type / Precipitation Amount / Storm Intensity), each row with
 * a stand-in icon disc and a placeholder value. Nothing here reads trial state yet — the per-attribute
 * values and real weather icons will be wired later.
 *
 * The heading comes from the shared `<DataSubsection>` (a real `<h3>` "Weather Outcome" under the Data
 * region's `<h2>`), matching the bananas Data panel's composition.
 */

/**
 * The six weather attributes, in the demo's order. `short` is the condensed label CSS swaps in when the
 * column narrows; the row keeps the full `label` as its accessible name.
 */
interface WeatherAttribute {
  key: string;
  label: string;
  short?: string;
}

const WEATHER_ATTRIBUTES: readonly WeatherAttribute[] = [
  { key: "sky", label: "Sky" },
  { key: "pressure", label: "Pressure" },
  { key: "wind", label: "Wind" },
  { key: "precipType", label: "Precipitation Type", short: "Precip Type" },
  { key: "precipAmount", label: "Precipitation Amount", short: "Precip Amount" },
  { key: "intensity", label: "Storm Intensity" },
];

const PLACEHOLDER = "–";

export function NoreasterDataPanel() {
  return (
    <div className="noreaster-data-panel">
      <DataSubsection title="Weather Outcome">
        {/* Outcome description pill — empty default state. */}
        <div className="wo-pill">{PLACEHOLDER}</div>

        <table className="wo-table">
          <tbody>
            {WEATHER_ATTRIBUTES.map(({ key, label, short }) => (
              <tr key={key}>
                {/* For condensable rows the header's accessible name is the FULL label (aria-label),
                    and both visible spans are aria-hidden — so CSS can swap the visible text at narrow
                    widths without changing what assistive tech reads. Simple rows name themselves from
                    their visible text. */}
                {/* The `<th>` stays a real table cell (its inner .wo-attr does the icon+label flex) so
                    the collapsed row dividers render as one continuous line across both cells. */}
                <th
                  scope="row"
                  className="wo-row-header"
                  {...(short ? { "aria-label": label } : {})}
                >
                  <span className="wo-attr">
                    {/* Stand-in disc (pure CSS); the real weather icon will replace it later. */}
                    <span className="wo-icon" aria-hidden="true" />
                    {short ? (
                      <span className="wo-label" aria-hidden="true">
                        <span className="wo-label-full">{label}</span>
                        <span className="wo-label-short">{short}</span>
                      </span>
                    ) : (
                      <span className="wo-label">{label}</span>
                    )}
                  </span>
                </th>
                <td className="wo-value">{PLACEHOLDER}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataSubsection>
    </div>
  );
}
