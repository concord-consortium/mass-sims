import { observer } from "mobx-react-lite";
import { type FunctionComponent, type SVGProps, useRef } from "react";
import Arrow1 from "../assets/icons/arrow-1.svg?react";
import Arrow2 from "../assets/icons/arrow-2.svg?react";
import Arrow3 from "../assets/icons/arrow-3.svg?react";
import Arrow4 from "../assets/icons/arrow-4.svg?react";
import CompassRose from "../assets/icons/compass-rose.svg?react";
import mapSatellite from "../assets/map/map-satellite.jpg";
import mapStreet from "../assets/map/map-street.png";
import { useStores } from "../stores/root-store";
import { convergedArrows } from "./converge";
import { PathwayNumber } from "./icons/pathway-number";
import { arrowTint } from "./selection-tint";
import { useStormAnimation } from "./use-storm-animation";
import { useStormRun } from "./use-storm-run";

import "./map-stage.scss";

const MAP_DESCRIPTION =
  "Map of the eastern United States, showing the coast from Maine in the north to Florida in the " +
  "south. The Atlantic Ocean is on the right and land is on the left. Boston is marked near the " +
  "coast in the northeast. Four numbered pathways show the directions from which air masses can " +
  "approach.";

// The four pathway arrows. Each SVG has its own bounding-box viewBox; position + size come from the
// per-arrow geometry in map-stage.scss. Numbers are NOT sequential with DOM order — arrows 1 & 4 are
// the land pathways, 2 & 3 the ocean pathways.
const ARROWS: { num: number; Icon: FunctionComponent<SVGProps<SVGSVGElement>> }[] = [
  { num: 1, Icon: Arrow1 },
  { num: 2, Icon: Arrow2 },
  { num: 3, Icon: Arrow3 },
  { num: 4, Icon: Arrow4 },
];

// The four numbered pathway pills (circled number + direction label), placed at the air-mass origins.
const PILLS: { num: number; label: string }[] = [
  { num: 1, label: "N/NW" },
  { num: 4, label: "W" },
  { num: 2, label: "S/SE" },
  { num: 3, label: "NE" },
];

/** Which basemap the stage shows. Not persisted — a view preference, driven by the control bar. */
export type MapView = "street" | "satellite";

/**
 * The map area: the base street map (an informative <img> whose alt is the full description) with the
 * satellite basemap layered over it, the compass rose, the four numbered pathway arrows, the four
 * pathway pills, and the Boston marker. All overlays are decorative; the map's meaning is carried by
 * the street <img> alt (the satellite image is decorative — same geography).
 *
 * `observer` so the arrows/pills track the active trial's selections: `mapView` selects the basemap
 * (crossfaded in CSS via `data-map-view`); each arrow tints + dims from the selections via a
 * `data-tint`/`data-dimmed` the stylesheet maps to theme colors.
 */
export const MapStage = observer(function MapStage({ mapView = "street" }: { mapView?: MapView }) {
  const { activeTrial: trial, ui } = useStores();
  const running = ui.isRunning(ui.selectedTrialLetter);

  // The overlay frame + arrow elements the runner drives imperatively during a run.
  const frameRef = useRef<HTMLDivElement>(null);
  const arrowsRef = useRef<Record<number, HTMLElement | null>>({});
  const stormContainerRef = useRef<HTMLSpanElement>(null);
  const stormCanvasRef = useRef<HTMLCanvasElement>(null);

  // Outcome to depict: the run's captured outcome while running, else the trial's committed one.
  const stormOutcome = running ? (ui.run?.outcome ?? null) : trial.outcome;
  const anim = useStormAnimation(stormCanvasRef, stormContainerRef, stormOutcome, running);
  useStormRun(frameRef, arrowsRef, anim);

  // Machine-readable run-state hook for tests; no visual effect on its own (`aria-busy` conveys
  // "running" to assistive tech separately).
  const runPhase = running ? "running" : trial.hasRun ? "done" : undefined;

  // Once running or run, the two selected arrows converge (runner-driven while running, static "removed"
  // after) and the two companion (un-selected) arrows + their pills are "hidden".
  const converged = convergedArrows(trial.landPathway, trial.oceanPathway);
  const runActive = running || trial.hasRun;
  const arrowRunState = (num: number): "removed" | "hidden" | undefined => {
    if (!runActive) return undefined;
    if (converged.includes(num)) return trial.hasRun ? "removed" : undefined; // running → runner-driven
    return "hidden"; // companion
  };
  const pillRunState = (num: number): "hidden" | undefined =>
    runActive && !converged.includes(num) ? "hidden" : undefined; // selected pill kept, companion hidden

  return (
    <div
      className="nor-stage"
      data-map-view={mapView}
      data-run-phase={runPhase}
      aria-busy={running ? "true" : undefined}
    >
      {/* Display basemaps at the art's true ratio (1400/667), height-filling & centered; no letterbox.
          The street <img> carries the informative alt; the satellite layer is decorative and crossfades
          in via data-map-view. Both sit behind the overlay frame. */}
      <img className="nor-map-img" src={mapStreet} alt={MAP_DESCRIPTION} />
      <img className="nor-map-img nor-map-img--satellite" src={mapSatellite} alt="" />

      {/* Overlay frame: a fixed 2:1 box at stage height, independent of the wider display art, so its %
          children hold their map positions. It's the coordinate basis for the run animation. See
          map-stage.scss. */}
      <div className="nor-map" ref={frameRef}>
        {/* Storm cloud canvas, centered on the map: driven by the runner during a run, painted to its
            final frame on restore. Decorative; behind the arrows/pills in DOM order. */}
        <span className="nor-storm" ref={stormContainerRef} aria-hidden="true">
          <canvas className="nor-storm-canvas" ref={stormCanvasRef} />
        </span>

        {ARROWS.map(({ num, Icon }) => {
          const { tint, dimmed } = arrowTint(
            num,
            trial.landPathway,
            trial.landTemperature,
            trial.oceanPathway,
          );
          return (
            <span
              key={num}
              ref={(el) => {
                arrowsRef.current[num] = el;
              }}
              className="nor-arrow"
              data-arrow={num}
              data-tint={tint}
              data-dimmed={dimmed ? "true" : undefined}
              data-run-state={arrowRunState(num)}
              aria-hidden="true"
            >
              <Icon />
            </span>
          );
        })}

        {PILLS.map(({ num, label }) => {
          // Pills track their arrow's dim state; they are not recolored.
          const { dimmed } = arrowTint(
            num,
            trial.landPathway,
            trial.landTemperature,
            trial.oceanPathway,
          );
          return (
            <div
              key={num}
              className="nor-pill"
              data-pathway={num}
              data-dimmed={dimmed ? "true" : undefined}
              data-run-state={pillRunState(num)}
              aria-hidden="true"
            >
              <PathwayNumber className="nor-pill-icon" num={num} />
              <span>{label}</span>
            </div>
          );
        })}

        <div className="nor-boston" aria-hidden="true">
          <span className="nor-boston-dot" />
          <span className="nor-boston-label">Boston</span>
        </div>
      </div>

      <span className="nor-compass" aria-hidden="true">
        <CompassRose />
      </span>

      {/* Pre-run prompt: shown once the setup is complete and the trial hasn't been run, and hidden
          while the run animation is in flight. The backdrop bleeds
          the section's blue down behind the pill's top; the pill itself is not aria-hidden — it's a
          genuine text cue, and the state is also conveyed by Run enabling. */}
      {trial.setupComplete && !trial.hasRun && !running ? (
        <>
          <div className="nor-prompt-backdrop" aria-hidden="true" />
          <div className="nor-prompt">
            Click <strong>Run</strong> to see if a nor’easter forms
          </div>
        </>
      ) : null}
    </div>
  );
});
