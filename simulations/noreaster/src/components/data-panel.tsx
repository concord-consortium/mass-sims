import { DataSubsection } from "@concord-consortium/mass-sims-shared";
import { observer } from "mobx-react-lite";
import { type ReactNode, useRef, useState } from "react";
import { OUTCOME_VALUES, type OutcomeValues } from "../model/outcome-values";
import type { Outcome } from "../model/weather";
import { useStores } from "../stores/root-store";
import { WeatherIcon } from "./icons/weather-icons";
import { OUTCOME_ICONS, type WeatherIconSet } from "./outcome-icons";
import { useCondensedLabels } from "./use-condensed-labels";
import { WeatherScene } from "./weather-scene";
import { NO_SCENE, SCENES } from "./weather-scenes";

import "./data-panel.scss";

/**
 * Nor'easter Data panel — the "Weather Outcome" table for the active trial. With no recorded outcome (unrun
 * or reset) every cell shows the placeholder and each icon slot is the stand-in disc; once run, the pill and
 * rows show the outcome's values + icons from `OUTCOME_VALUES` / `OUTCOME_ICONS`. It's an `observer` on
 * `activeTrial.outcome`, so filling and clearing are automatic. The heading is the shared `<DataSubsection>`.
 */

const PLACEHOLDER = "–";
const TITLE = "Weather Outcome";

/**
 * One attribute row. `value`/`icon` are thunks reading this row's data from the outcome sets (each `icon`
 * names a literal family + key, so the pairing is type-checked). `short` is the condensed label used when the
 * full one would wrap; the row keeps `label` as its accessible name.
 */
interface AttributeRow {
  label: string;
  short?: string;
  value: (values: OutcomeValues) => string;
  icon: (icons: WeatherIconSet) => ReactNode;
}

const WEATHER_ATTRIBUTES: readonly AttributeRow[] = [
  { label: "Sky", value: (v) => v.sky, icon: (i) => <WeatherIcon family="sky" icon={i.sky} /> },
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

/**
 * Whether the weather scene should fade in (vs. appear instantly) this render. Not inferable from `outcome`
 * alone — the same value arrives via Run, hydration, or trial-switch — so it keys off the `.volatile`
 * `runCompletedToken` that `handleRun` bumps only on a real Run: fade only when the token advanced AND the
 * outcome changed, so replay / hydration / trial-switch stay instant.
 */
function useJustFinalized(outcome: Outcome | null, runCompletedToken: number): boolean {
  // Adjust-state-during-render (not a render-phase ref mutation) so the "just finalized" edge is
  // StrictMode/concurrent-safe and lands on the SAME commit as `data-scene` — the CSS fade only arms when
  // opacity and `transition` change together.
  const [seen, setSeen] = useState({ token: runCompletedToken, outcome, animate: false });
  if (seen.token !== runCompletedToken || seen.outcome !== outcome) {
    const freshFinalization =
      runCompletedToken !== seen.token && outcome !== null && outcome !== seen.outcome;
    setSeen({ token: runCompletedToken, outcome, animate: freshFinalization });
  }
  // Latched until the token/outcome next changes; don't reset it — flipping `data-animate` mid-fade sets
  // `transition:none` and cancels the in-flight fade.
  return seen.animate;
}

export const NoreasterDataPanel = observer(function NoreasterDataPanel() {
  const { activeTrial, ui } = useStores();
  const outcome = activeTrial.outcome;
  const values = outcome ? OUTCOME_VALUES[outcome] : null;
  const icons = outcome ? OUTCOME_ICONS[outcome] : null;
  const scene = outcome ? SCENES[outcome] : NO_SCENE;
  const animateAppearance = useJustFinalized(outcome, ui.runCompletedToken);
  const panelRef = useRef<HTMLDivElement>(null);
  useCondensedLabels(panelRef, outcome);

  return (
    <div
      className="noreaster-data-panel"
      ref={panelRef}
      data-scene-theme={scene.dark ? "dark" : "light"}
    >
      <WeatherScene
        scene={scene}
        outcome={outcome}
        animate={animateAppearance}
        panelRef={panelRef}
      />
      <DataSubsection title={TITLE}>
        {/* The outcome banner once run, else the placeholder. */}
        <div className={`wo-pill${values ? " wo-pill--filled" : ""}`}>
          {values ? values.label : PLACEHOLDER}
        </div>
        <dl className="wo-table">
          {WEATHER_ATTRIBUTES.map(({ label, short, value, icon }) => (
            <div className="wo-row" key={label}>
              {/* Condensable rows expose the FULL label via aria-label and hide both visible spans, so the
                  a11y name doesn't change when the visible text swaps. Simple rows name themselves. */}
              <dt className="wo-row-header" {...(short ? { "aria-label": label } : {})}>
                {/* Stand-in disc when empty; the real weather SVG once run. */}
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
