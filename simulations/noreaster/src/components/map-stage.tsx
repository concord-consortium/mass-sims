import { observer } from "mobx-react-lite";
import type { FunctionComponent, SVGProps } from "react";
import Arrow1 from "../assets/icons/arrow-1.svg?react";
import Arrow2 from "../assets/icons/arrow-2.svg?react";
import Arrow3 from "../assets/icons/arrow-3.svg?react";
import Arrow4 from "../assets/icons/arrow-4.svg?react";
import CompassRose from "../assets/icons/compass-rose.svg?react";
import mapSatellite from "../assets/map/map-satellite.jpg";
import mapStreet from "../assets/map/map-street.png";
import { useStores } from "../stores/root-store";
import { PathwayNumber } from "./icons/pathway-number";
import { arrowTint } from "./selection-tint";

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
  const { activeTrial: trial } = useStores();

  return (
    <div className="nor-stage" data-map-view={mapView}>
      {/* Aspect-locked map box (2:1). Overlays are children positioned as % of this box, so they
          track the same map feature as the map scales; see map-stage.scss. */}
      <div className="nor-map">
        <img className="nor-map-img" src={mapStreet} alt={MAP_DESCRIPTION} />
        {/* Satellite basemap — decorative (same geography); crossfaded in via data-map-view. */}
        <img className="nor-map-img nor-map-img--satellite" src={mapSatellite} alt="" />

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
              className="nor-arrow"
              data-arrow={num}
              data-tint={tint}
              data-dimmed={dimmed ? "true" : undefined}
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

      {/* Pre-run prompt: shown once the setup is complete and the trial hasn't been run (matches the
          demo). Not aria-hidden — it's a genuine text cue; the actionable state is also conveyed by
          the Run button enabling. */}
      {trial.setupComplete && !trial.hasRun ? (
        <div className="nor-prompt">
          Click <strong>Run</strong> to see if a nor’easter forms
        </div>
      ) : null}
    </div>
  );
});
