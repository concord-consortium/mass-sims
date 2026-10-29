import DryIcon from "../../assets/dry-icon.svg?react";
import GraniteIcon from "../../assets/granite-icon.svg?react";
import LimestoneIcon from "../../assets/limestone-icon.svg?react";
import WetIcon from "../../assets/wet-icon.svg?react";
import {
  type CollapseTrialLetter,
  MOISTURE_NOTES,
  type Moisture,
  type RockType,
  TRIAL_CONDITIONS,
} from "../../trial-conditions";

// Multi-color icons: they keep their own colors instead of taking `currentColor`.
const ROCK_ICONS: Record<RockType, typeof LimestoneIcon> = {
  Limestone: LimestoneIcon,
  Granite: GraniteIcon,
};
const MOISTURE_ICONS: Record<Moisture, typeof WetIcon> = { Wet: WetIcon, Dry: DryIcon };

/**
 * A trial card's screen-reader name, e.g. "Trial A. Limestone, Dry, under 10 rainy days a year.
 * Sampled 3 times", or "… Not yet sampled" when the trial has no samples.
 */
export function trialAriaLabel(letter: CollapseTrialLetter, sampleCount: number): string {
  const { rock, moisture } = TRIAL_CONDITIONS[letter];
  const sampled =
    sampleCount === 0
      ? "Not yet sampled"
      : `Sampled ${sampleCount} ${sampleCount === 1 ? "time" : "times"}`;
  return `Trial ${letter}. ${rock}, ${moisture}, ${MOISTURE_NOTES[moisture].spoken}. ${sampled}`;
}

/** The visible card body. `aria-hidden` because `trialAriaLabel` already names the card. */
export function TrialCardBody({ letter }: { letter: CollapseTrialLetter }) {
  const { rock, moisture } = TRIAL_CONDITIONS[letter];
  const RockIcon = ROCK_ICONS[rock];
  const MoistureIcon = MOISTURE_ICONS[moisture];
  return (
    <div className="trial-card-body" aria-hidden="true">
      <div className="collapse-attr-row">
        <span className="collapse-attr-icon">
          <RockIcon />
        </span>
        <span className="collapse-attr-label">{rock}</span>
      </div>
      <div className="collapse-attr-row">
        <span className="collapse-attr-icon">
          <MoistureIcon />
        </span>
        <span className="collapse-attr-label has-note">{moisture}</span>
        <span className="collapse-attr-noteline">{MOISTURE_NOTES[moisture].text}</span>
      </div>
    </div>
  );
}
