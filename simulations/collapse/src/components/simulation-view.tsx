import { Button, Slider, Switch } from "@concord-consortium/mass-sims-shared";
import { END_YEAR, isCollapsed, RAINFALL, START_YEAR } from "../model/collapse";
import type { SimInput } from "../model/types";
import { CrossSection } from "./cross-section";
import "./simulation-view.scss";

export interface SimulationViewProps {
  input: SimInput;
  /** Current year on the timeline. */
  year: number;
  isPlaying: boolean;
  rainstormActive: boolean;
  /** Climate/soil toggles lock once the timeline has advanced (reset to change them). */
  inputsLocked: boolean;
  trialLabel: string;
  onChangeInput: (patch: Partial<SimInput>) => void;
  onPlayPause: () => void;
  onScrubYear: (year: number) => void;
  /** Start a 10-second rainstorm (it stops itself; the button is disabled meanwhile). */
  onStartRainstorm: () => void;
  onReset: () => void;
}

export function SimulationView({
  input,
  year,
  isPlaying,
  rainstormActive,
  inputsLocked,
  trialLabel,
  onChangeInput,
  onPlayPause,
  onScrubYear,
  onStartRainstorm,
  onReset,
}: SimulationViewProps) {
  const rain = RAINFALL[input.wetness];
  const displayYear = Math.round(year);
  const collapsed = isCollapsed(input, year);
  const atEnd = year >= END_YEAR;

  return (
    <div className="simulation-view">
      <span className="trial-badge" aria-hidden="true">
        {trialLabel}
      </span>

      <div className="sim-stage">
        <CrossSection input={input} year={year} rainstormActive={rainstormActive} />
      </div>

      <div className="settings">
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
            isSelected={input.wind === "windy"}
            isDisabled={inputsLocked}
            onChange={(on) => onChangeInput({ wind: on ? "windy" : "calm" })}
            action="wind_set"
            actionParams={{ wind: input.wind === "windy" ? "calm" : "windy" }}
          >
            {input.wind === "windy" ? "Windy" : "Calm"}
          </Switch>
        </div>

        <div className="setting">
          <Switch
            isSelected={input.soil === "limestone"}
            isDisabled={inputsLocked}
            onChange={(on) => onChangeInput({ soil: on ? "limestone" : "bedrock" })}
            action="soil_set"
            actionParams={{ soil: input.soil === "limestone" ? "bedrock" : "limestone" }}
          >
            {input.soil === "limestone" ? "Limestone" : "Bedrock"}
          </Switch>
        </div>
      </div>

      <div className="transport">
        <Button
          action={isPlaying ? "pause_pressed" : "play_pressed"}
          onPress={onPlayPause}
          isDisabled={atEnd || rainstormActive}
        >
          {isPlaying ? "Pause" : "Play"}
        </Button>
        <span className="year-readout" aria-live="off">
          Year <strong>{displayYear}</strong>
          {collapsed ? <em className="collapse-flag"> — collapse!</em> : null}
        </span>
        <Button
          className={`rainstorm-button${rainstormActive ? " is-raining" : ""}`}
          action="show_rainstorm_pressed"
          onPress={onStartRainstorm}
          isDisabled={rainstormActive}
        >
          {rainstormActive ? "Raining…" : "Show rainstorm"}
        </Button>
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
          isDisabled={rainstormActive}
          onChange={onScrubYear}
          // Years aren't grouped — render 2014, not "2,014".
          formatOptions={{ useGrouping: false }}
          action="year_scrubbed"
        />
      </div>
    </div>
  );
}
