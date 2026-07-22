import { Button, Slider, Switch } from "@concord-consortium/mass-sims-shared";
import { END_YEAR, isCollapsed, LOCATIONS, RAINFALL, START_YEAR } from "../model/collapse";
import type { SimInput } from "../model/types";
import { CrossSection } from "./cross-section";
import "./simulation-view.scss";

export interface SimulationViewProps {
  input: SimInput;
  /** Current year on the timeline. */
  year: number;
  isPlaying: boolean;
  /** Climate/soil toggles lock once the timeline has advanced (reset to change them). */
  inputsLocked: boolean;
  trialLabel: string;
  onChangeInput: (patch: Partial<SimInput>) => void;
  onPlayPause: () => void;
  onScrubYear: (year: number) => void;
  onReset: () => void;
}

export function SimulationView({
  input,
  year,
  isPlaying,
  inputsLocked,
  trialLabel,
  onChangeInput,
  onPlayPause,
  onScrubYear,
  onReset,
}: SimulationViewProps) {
  const rain = RAINFALL[input.wetness];
  const displayYear = Math.round(year);
  const collapsed = isCollapsed(input, year);
  const atEnd = year >= END_YEAR;
  const isLouisville = input.location === "louisville";

  return (
    <div className="simulation-view">
      <span className="trial-badge" aria-hidden="true">
        {trialLabel}
      </span>

      <div className="sim-stage">
        <div className="stage-caption">
          <strong>{LOCATIONS[input.location].name}</strong> — {LOCATIONS[input.location].blurb}
        </div>
        <CrossSection input={input} year={year} />
      </div>

      <div className="settings">
        <div className="setting">
          <span className="setting-title">Terrain</span>
          <div className="flank-toggle">
            <span className={isLouisville ? "choice" : "choice active"}>Bowling Green</span>
            <Switch
              isSelected={isLouisville}
              isDisabled={inputsLocked}
              onChange={(on) => onChangeInput({ location: on ? "louisville" : "bowling-green" })}
              action="location_set"
              actionParams={{ location: isLouisville ? "bowling-green" : "louisville" }}
            >
              <span className="sr-only">Terrain: Bowling Green or Louisville</span>
            </Switch>
            <span className={isLouisville ? "choice active" : "choice"}>Louisville</span>
          </div>
        </div>

        <div className="setting">
          <Switch
            isSelected={input.wetness === "wet"}
            isDisabled={inputsLocked}
            onChange={(on) => onChangeInput({ wetness: on ? "wet" : "dry" })}
            action="wetness_set"
            actionParams={{ wetness: input.wetness === "wet" ? "dry" : "wet" }}
          >
            {input.wetness === "wet" ? "Wet climate" : "Dry climate"}
          </Switch>
          <span className="setting-detail">
            {rain.inchesPerYear} in/yr · {rain.rainyDays} rainy days
          </span>
        </div>

        <div className="setting">
          <Switch
            isSelected={input.soil === "limestone"}
            isDisabled={inputsLocked}
            onChange={(on) => onChangeInput({ soil: on ? "limestone" : "granite" })}
            action="soil_set"
            actionParams={{ soil: input.soil === "limestone" ? "granite" : "limestone" }}
          >
            <TwoChoiceLabel
              a="Limestone"
              b="Granite"
              selected={input.soil === "limestone" ? "a" : "b"}
            />
          </Switch>
        </div>
      </div>

      <div className="transport">
        <Button
          action={isPlaying ? "pause_pressed" : "play_pressed"}
          onPress={onPlayPause}
          isDisabled={atEnd}
        >
          {isPlaying ? "Pause" : "Play"}
        </Button>
        <span className="year-readout" aria-live="off">
          Year <strong>{displayYear}</strong>
          {collapsed ? <em className="collapse-flag"> — collapse!</em> : null}
        </span>
        <Button action="reset_pressed" onPress={onReset} isDisabled={year === START_YEAR}>
          Reset
        </Button>
      </div>

      <div className="timeline">
        <Slider
          label="Year"
          value={displayYear}
          minValue={START_YEAR}
          maxValue={END_YEAR}
          step={1}
          onChange={onScrubYear}
          // Years aren't grouped — render 2014, not "2,014".
          formatOptions={{ useGrouping: false }}
          action="year_scrubbed"
        />
      </div>
    </div>
  );
}

/** Switch label that shows both choices with the active one emphasized (e.g. "Limestone / Granite"). */
function TwoChoiceLabel({ a, b, selected }: { a: string; b: string; selected: "a" | "b" }) {
  return (
    <span className="two-choice">
      <span className={selected === "a" ? "choice active" : "choice"}>{a}</span>
      <span className="choice-sep">/</span>
      <span className={selected === "b" ? "choice active" : "choice"}>{b}</span>
    </span>
  );
}
