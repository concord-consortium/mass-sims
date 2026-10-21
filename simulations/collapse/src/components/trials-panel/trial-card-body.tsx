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

// Multi-color art: each icon keeps the colors in its own file (no `currentColor` theming).
const ROCK_ICONS: Record<RockType, typeof LimestoneIcon> = {
  Limestone: LimestoneIcon,
  Granite: GraniteIcon,
};
const MOISTURE_ICONS: Record<Moisture, typeof WetIcon> = { Wet: WetIcon, Dry: DryIcon };

/**
 * The enriched screen-reader label for a trial card, built from the trial's fixed conditions:
 * "Trial A. Limestone, Dry, fewer than 10 rainy days per year. Not yet sampled". Sample counts come
 * with the data table story. Passed to the shared `<TrialCard>` via its `ariaLabel` prop.
 */
export function trialAriaLabel(letter: CollapseTrialLetter): string {
  const { rock, moisture } = TRIAL_CONDITIONS[letter];
  return `Trial ${letter}. ${rock}, ${moisture}, ${MOISTURE_NOTES[moisture].spoken}. Not yet sampled`;
}

/**
 * The visible body of a trial card (the shared `<TrialCard>`'s `children`): the rock-type row and the
 * moisture row, each an icon plus a label, with the moisture note on its own line below. `aria-hidden`
 * because the card's accessible name is the enriched `ariaLabel` (see `trialAriaLabel`).
 */
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
