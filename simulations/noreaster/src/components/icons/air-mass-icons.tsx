import type { ReactNode } from "react";
import AirMassLandIcon from "../../assets/icons/air-mass-land.svg?react";
import AirMassOceanIcon from "../../assets/icons/air-mass-ocean.svg?react";
import HumidityDryIcon from "../../assets/icons/humidity-dry.svg?react";
import HumidityHumidIcon from "../../assets/icons/humidity-humid.svg?react";
import TempColdIcon from "../../assets/icons/temp-cold.svg?react";
import TempCoolIcon from "../../assets/icons/temp-cool.svg?react";
import TempWarmIcon from "../../assets/icons/temp-warm.svg?react";
import type {
  Humidity,
  LandPathway,
  LandTemperature,
  OceanPathway,
  OceanTemperature,
} from "../../model/weather";
import { PathwayNumber } from "./pathway-number";

// The source for the icons rendered by both the air-mass selectors and the trial-card body, including
// the non-sequential pathway numbering. (selection-tint.ts and map-stage.tsx derive the same numbering
// for their own arrow/pill purposes; those aren't consolidated here.) The maps are keyed by the model
// enums, so adding a value in weather.ts turns "no icon for it" into a compile error rather than a
// silent wrong-icon fallback.

/**
 * The circled MAP number for a pathway value. NON-SEQUENTIAL — it's the map's numbering, not the option
 * order: N/NW → 1, W → 4 (land); S/SE → 2, NE → 3 (ocean). Exposed as data (not only via the icon
 * helper) so the selector's a11y `textValue` ("1 N/NW") can read the number too.
 */
export const PATHWAY_NUMBER: Readonly<Record<LandPathway | OceanPathway, number>> = {
  "N/NW": 1,
  W: 4,
  "S/SE": 2,
  NE: 3,
};

const HUMIDITY_ICON: Readonly<Record<Humidity, ReactNode>> = {
  Dry: <HumidityDryIcon />,
  Humid: <HumidityHumidIcon />,
};

const TEMP_ICON: Readonly<Record<LandTemperature | OceanTemperature, ReactNode>> = {
  Cold: <TempColdIcon />,
  Warm: <TempWarmIcon />,
  Cool: <TempCoolIcon />,
};

/** The circled pathway-number icon for a pathway value (decorative; the number reaches AT via text). */
export function pathwayNumber(pathway: LandPathway | OceanPathway): ReactNode {
  return <PathwayNumber num={PATHWAY_NUMBER[pathway]} />;
}

/** The dry / humid droplet icon for a humidity value. */
export function humidityIcon(humidity: Humidity): ReactNode {
  return HUMIDITY_ICON[humidity];
}

/** The thermometer icon for an air-mass temperature (land Cold/Warm or derived ocean Warm/Cool). */
export function tempIcon(temp: LandTemperature | OceanTemperature): ReactNode {
  return TEMP_ICON[temp];
}

/** The land / ocean air-mass glyph (tinted by the consumer via the `data-tint` convention). */
export function airMassIcon(airMass: "land" | "ocean"): ReactNode {
  return airMass === "land" ? <AirMassLandIcon /> : <AirMassOceanIcon />;
}
