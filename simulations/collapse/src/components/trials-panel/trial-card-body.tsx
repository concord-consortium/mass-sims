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
export const ROCK_ICONS: Record<RockType, typeof LimestoneIcon> = {
  Limestone: LimestoneIcon,
  Granite: GraniteIcon,
};
export const MOISTURE_ICONS: Record<Moisture, typeof WetIcon> = { Wet: WetIcon, Dry: DryIcon };

/** One condition: its icon and label, and on the card the note under the label. */
export function ConditionAttr({
  icon: Icon,
  label,
  note,
}: {
  icon: typeof LimestoneIcon;
  label: string;
  note?: string;
}) {
  return (
    <div className="collapse-attr-row">
      <span className="collapse-attr-icon">
        <Icon />
      </span>
      <span className={note ? "collapse-attr-label has-note" : "collapse-attr-label"}>{label}</span>
      {note && <span className="collapse-attr-noteline">{note}</span>}
    </div>
  );
}

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
  return (
    <div className="trial-card-body" aria-hidden="true">
      <ConditionAttr icon={ROCK_ICONS[rock]} label={rock} />
      <ConditionAttr
        icon={MOISTURE_ICONS[moisture]}
        label={moisture}
        note={MOISTURE_NOTES[moisture].text}
      />
    </div>
  );
}
