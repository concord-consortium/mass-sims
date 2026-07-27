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

// The single source for "air-mass value → icon", consumed by both the air-mass selectors and the
// trial-card body so the mapping — above all the non-sequential pathway numbering — lives in one place.

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

/** The circled pathway-number icon for a pathway value (decorative; the number reaches AT via text). */
export function pathwayNumber(pathway: LandPathway | OceanPathway): ReactNode {
  return <PathwayNumber num={PATHWAY_NUMBER[pathway]} />;
}

/** The dry / humid droplet icon for a humidity value. */
export function humidityIcon(humidity: Humidity): ReactNode {
  return humidity === "Humid" ? <HumidityHumidIcon /> : <HumidityDryIcon />;
}

/** The thermometer icon for an air-mass temperature (land Cold/Warm or derived ocean Warm/Cool). */
export function tempIcon(temp: LandTemperature | OceanTemperature): ReactNode {
  if (temp === "Warm") return <TempWarmIcon />;
  if (temp === "Cool") return <TempCoolIcon />;
  return <TempColdIcon />; // "Cold"
}

/** The land / ocean air-mass glyph (tinted by the consumer via the `data-tint` convention). */
export function airMassIcon(airMass: "land" | "ocean"): ReactNode {
  return airMass === "land" ? <AirMassLandIcon /> : <AirMassOceanIcon />;
}
