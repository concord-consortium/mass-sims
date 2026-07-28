import { observer } from "mobx-react-lite";
import type { ReactNode } from "react";
import { OUTCOME_VALUES } from "../../model/outcome-values";
import type {
  Humidity,
  LandPathway,
  LandTemperature,
  OceanPathway,
  OceanTemperature,
} from "../../model/weather";
import type { TrialModelInstance } from "../../stores/trial-model";
import { airMassIcon, humidityIcon, pathwayNumber, tempIcon } from "../icons/air-mass-icons";
import { tempTint } from "../selection-tint";

/**
 * Split an outcome label into its two display lines at the FIRST space, which yields the intended break
 * for every approved outcome. The input is always `OUTCOME_VALUES[outcome].label` (no re-typed copy).
 */
export function outcomeLabelLines(label: string): [string, string] {
  const i = label.indexOf(" ");
  return i === -1 ? [label, ""] : [label.slice(0, i), label.slice(i + 1)];
}

/**
 * The trial card's accessible name — the only channel to assistive tech for a card's settings + outcome
 * (the visible body isn't exposed; see `TrialCardBody`). `"Trial X"`, then a `Land:`/`Ocean:` clause per
 * air mass with any field set (each listing only its set fields; ocean includes the derived
 * temperature), then the `OUTCOME_VALUES` label once run.
 */
export function trialAriaLabel(letter: string, trial: TrialModelInstance): string {
  const parts = [`Trial ${letter}`];
  const land = [trial.landPathway, trial.landHumidity, trial.landTemperature].filter(Boolean);
  if (land.length > 0) parts.push(`Land: ${land.join(", ")}`);
  const ocean = [trial.oceanPathway, trial.oceanHumidity, trial.oceanTemperature].filter(Boolean);
  if (ocean.length > 0) parts.push(`Ocean: ${ocean.join(", ")}`);
  if (trial.outcome) parts.push(OUTCOME_VALUES[trial.outcome].label);
  return parts.join(". ");
}

/** One row (per-field icon + label) of an air-mass section; omitted entirely when its value is unset. */
function AmRow({
  field,
  icon,
  label,
}: {
  /** Selects the grid-row (1/2/3) and, for `pathway`, the heavier label weight. */
  field: "pathway" | "humidity" | "temperature";
  icon: ReactNode;
  label: string;
}) {
  return (
    <>
      <span className={`nor-card-row-icon nor-card-${field}`}>{icon}</span>
      <span className={`nor-card-label nor-card-${field}`}>{label}</span>
    </>
  );
}

/**
 * One air-mass section: the tinted land/ocean glyph spanning all three rows, plus a pathway / humidity /
 * temperature row per set field. Rendered only when the air mass has a selection, so the glyph always has
 * a value to tint by.
 */
function AmSection({
  airMass,
  pathway,
  humidity,
  temperature,
}: {
  airMass: "land" | "ocean";
  pathway: LandPathway | OceanPathway | null;
  humidity: Humidity | null;
  temperature: LandTemperature | OceanTemperature | null;
}) {
  return (
    <div className="nor-card-am-section">
      <span className="nor-card-am-icon" data-tint={tempTint(temperature)}>
        {airMassIcon(airMass)}
      </span>
      {pathway ? <AmRow field="pathway" icon={pathwayNumber(pathway)} label={pathway} /> : null}
      {humidity ? <AmRow field="humidity" icon={humidityIcon(humidity)} label={humidity} /> : null}
      {temperature ? (
        <AmRow field="temperature" icon={tempIcon(temperature)} label={temperature} />
      ) : null}
    </div>
  );
}

/**
 * The visible body of a Nor'easter trial card (the shared `<TrialCard>`'s `children`): the Land and
 * Ocean air-mass sections and, once run, the two-line outcome banner. An empty trial renders nothing
 * (letter badge only).
 *
 * The banner indexes `OUTCOME_VALUES` on `trial.outcome` itself (not the separate `hasRun` getter,
 * which TypeScript won't narrow from), so "banner iff outcome" is explicit without a `!` assertion.
 */
export const TrialCardBody = observer(function TrialCardBody({
  trial,
}: {
  trial: TrialModelInstance;
}) {
  const landHasData = !!(trial.landPathway || trial.landHumidity || trial.landTemperature);
  const oceanHasData = !!(trial.oceanPathway || trial.oceanHumidity);
  const outcomeLabel = trial.outcome ? OUTCOME_VALUES[trial.outcome].label : null;
  const [outcomeLine1, outcomeLine2] = outcomeLabel ? outcomeLabelLines(outcomeLabel) : ["", ""];

  return (
    <div className="trial-card-body">
      {landHasData ? (
        <AmSection
          airMass="land"
          pathway={trial.landPathway}
          humidity={trial.landHumidity}
          temperature={trial.landTemperature}
        />
      ) : null}
      {oceanHasData ? (
        <AmSection
          airMass="ocean"
          pathway={trial.oceanPathway}
          humidity={trial.oceanHumidity}
          temperature={trial.oceanTemperature}
        />
      ) : null}
      {outcomeLabel ? (
        <div className="nor-card-outcome">
          <span className="nor-card-outcome-line">{outcomeLine1}</span>
          <span className="nor-card-outcome-line">{outcomeLine2}</span>
        </div>
      ) : null}
    </div>
  );
});
