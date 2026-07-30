import { DataSubsection, useReducedMotion } from "@concord-consortium/mass-sims-shared";
import { observer } from "mobx-react-lite";
import { type CSSProperties, type ReactNode, useRef } from "react";
import { OUTCOME_VALUES, type OutcomeValues } from "../model/outcome-values";
import { useStores } from "../stores/root-store";
import { WeatherIcon } from "./icons/weather-icons";
import { OUTCOME_ICONS, type WeatherIconSet } from "./outcome-icons";
import { useCondensedLabels } from "./use-condensed-labels";
import { useJustFinalized } from "./use-just-finalized";
import { usePillPhase } from "./use-pill-phase";
import { useProgressBar } from "./use-progress-bar";
import { WeatherScene } from "./weather-scene";
import { sceneFor } from "./weather-scenes";

import "./data-panel.scss";

/**
 * Nor'easter Data panel — the "Weather Outcome" table for the active trial. With no recorded outcome (unrun
 * or reset) every cell shows the placeholder and each icon slot is the stand-in disc; once run, the pill and
 * rows show the outcome's values + icons from `OUTCOME_VALUES` / `OUTCOME_ICONS`. It's an `observer` on
 * `activeTrial.outcome`, so filling and clearing are automatic. The heading is the shared `<DataSubsection>`.
 *
 * During a run the pill shows a progress bar synced to the Sim-panel animation (`useProgressBar`) and a
 * "Simulating…" / white-outlined-outcome face (`usePillPhase`); on completion the rows stagger-fade in on a
 * first run (the `useJustFinalized` signal, shared with the weather scene).
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

export const NoreasterDataPanel = observer(function NoreasterDataPanel() {
  const { activeTrial, ui } = useStores();
  const outcome = activeTrial.outcome;
  const values = outcome ? OUTCOME_VALUES[outcome] : null;
  const icons = outcome ? OUTCOME_ICONS[outcome] : null;
  const animateAppearance = useJustFinalized(outcome, ui.runCompletedToken);

  // The in-progress run (only ever the shown trial's — `selectTrial` cancels any other) and the pill's
  // state around it. `transition` is the single provenance both the pill CSS and the progress fill read,
  // so the label crossfade and the bar can't disagree about start / completion / cancellation.
  const run = ui.run;
  // Under reduced motion the run finalizes near-instantly, so gate the simulating faces off — the pill
  // resolves straight to the outcome instead of relying on React flushing the finalize before paint. The
  // fill loop in `useProgressBar` is gated the same way.
  const reducedMotion = useReducedMotion();
  const runningHere = ui.isRunning(ui.selectedTrialLetter) && !reducedMotion;
  const { phase, transition } = usePillPhase({
    runningHere,
    replay: run?.replay ?? false,
    outcome,
    runId: ui.runId,
    runCompletedToken: ui.runCompletedToken,
  });

  const panelRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  useCondensedLabels(panelRef, outcome);
  useProgressBar(fillRef, pillRef, run, transition);

  return (
    <div
      className="noreaster-data-panel"
      ref={panelRef}
      data-scene-theme={sceneFor(outcome).dark ? "dark" : "light"}
    >
      <WeatherScene outcome={outcome} animate={animateAppearance} panelRef={panelRef} />
      <DataSubsection title={TITLE}>
        {/* The Weather-Outcome pill: a progress fill behind the label, the in-flow outcome banner (owns the
            pill height + the @container condense), and an absolute "Simulating…" overlay that crossfades
            with it during a run. `data-phase` selects the face; `data-animate` arms the crossfades. */}
        <div
          className={`wo-pill${values ? " wo-pill--filled" : ""}`}
          data-phase={phase}
          data-animate={transition === "instant" ? "instant" : "fade"}
          ref={pillRef}
        >
          <span className="wo-progress-fill" aria-hidden="true" ref={fillRef} />
          <span className="wo-pill-label wo-pill-label--outcome">
            {values ? values.label : PLACEHOLDER}
          </span>
          {/* Kept mounted (aria-hidden) so the completion crossfade has a layer to fade out — visually
              hidden except in the simulating phases. Excluded from the pill's a11y name; the run narrates
              through the shared Announcer instead. */}
          <span className="wo-pill-label wo-pill-label--simulating" aria-hidden="true">
            Simulating…
          </span>
        </div>
        {/* `data-animate="fade"` only on a fresh first-run finalize (via `useJustFinalized`) staggers the
            rows in; replay / hydration / trial-switch / reset stay instant (the rows are already shown). */}
        <dl className="wo-table" data-animate={animateAppearance ? "fade" : "instant"}>
          {WEATHER_ATTRIBUTES.map(({ label, short, value, icon }, i) => (
            <div className="wo-row" key={label} style={{ "--wo-row-index": i } as CSSProperties}>
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
