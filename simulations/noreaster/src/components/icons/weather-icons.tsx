import type { ComponentType, SVGProps } from "react";

// Weather-outcome icons. Themed via `currentColor` — the consumer (`.wo-icon`) supplies
// `color: theme.$icon-color` — EXCEPT the deliberately fixed fills in the source SVGs:
// `sky-sunny` and the sun in `sky-clearing-breezy` are gold (#B08C00), and `wind-nw-gusty`
// uses `currentColor`-based gradients. Do not normalize those fills.
import PrecipAmountHeavy from "../../assets/icons/weather/precip-amount-heavy.svg?react";
import PrecipAmountLight from "../../assets/icons/weather/precip-amount-light.svg?react";
import PrecipAmountModerate from "../../assets/icons/weather/precip-amount-moderate.svg?react";
import PrecipAmountNone from "../../assets/icons/weather/precip-amount-none.svg?react";
import PrecipAmountTrace from "../../assets/icons/weather/precip-amount-trace.svg?react";
import PrecipTypeLightRain from "../../assets/icons/weather/precip-type-light-rain.svg?react";
import PrecipTypeNone from "../../assets/icons/weather/precip-type-none.svg?react";
import PrecipTypeRain from "../../assets/icons/weather/precip-type-rain.svg?react";
import PrecipTypeStrayShower from "../../assets/icons/weather/precip-type-stray-shower.svg?react";
import PressureHigh from "../../assets/icons/weather/pressure-high.svg?react";
import PressureLow from "../../assets/icons/weather/pressure-low.svg?react";
import PressureNearNormal from "../../assets/icons/weather/pressure-near-normal.svg?react";
import PressureRising from "../../assets/icons/weather/pressure-rising.svg?react";
import PressureSlightlyLow from "../../assets/icons/weather/pressure-slightly-low.svg?react";
import SkyClearingBreezy from "../../assets/icons/weather/sky-clearing-breezy.svg?react";
import SkyCloudy from "../../assets/icons/weather/sky-cloudy.svg?react";
import SkyOvercast from "../../assets/icons/weather/sky-overcast.svg?react";
import SkyOvercastHazy from "../../assets/icons/weather/sky-overcast-hazy.svg?react";
import SkySunny from "../../assets/icons/weather/sky-sunny.svg?react";
import StormModerate from "../../assets/icons/weather/storm-moderate.svg?react";
import StormNone from "../../assets/icons/weather/storm-none.svg?react";
import StormStrong from "../../assets/icons/weather/storm-strong.svg?react";
import StormWeak from "../../assets/icons/weather/storm-weak.svg?react";
import WindNeHigh from "../../assets/icons/weather/wind-ne-high.svg?react";
import WindNeLow from "../../assets/icons/weather/wind-ne-low.svg?react";
import WindNeMedium from "../../assets/icons/weather/wind-ne-medium.svg?react";
import WindNone from "../../assets/icons/weather/wind-none.svg?react";
import WindNwGusty from "../../assets/icons/weather/wind-nw-gusty.svg?react";
import WindSseLight from "../../assets/icons/weather/wind-sse-light.svg?react";

/**
 * The weather-icon registry: `ICONS[family][key]` → the SVG React component. `OUTCOME_ICONS`
 * (outcome-icons.ts) references these keys, and the `IconKey` type below makes an invalid `(family, key)`
 * pair a compile error.
 */
export const ICONS = {
  sky: {
    sunny: SkySunny,
    overcast: SkyOvercast,
    cloudy: SkyCloudy,
    overcastHazy: SkyOvercastHazy,
    clearingBreezy: SkyClearingBreezy,
  },
  pressure: {
    high: PressureHigh,
    low: PressureLow,
    slightlyLow: PressureSlightlyLow,
    nearNormal: PressureNearNormal,
    rising: PressureRising,
  },
  wind: {
    neHigh: WindNeHigh,
    neMedium: WindNeMedium,
    neLow: WindNeLow,
    nwGusty: WindNwGusty,
    sseLight: WindSseLight,
    none: WindNone,
  },
  precipType: {
    rain: PrecipTypeRain,
    lightRain: PrecipTypeLightRain,
    strayShower: PrecipTypeStrayShower,
    none: PrecipTypeNone,
  },
  precipAmount: {
    heavy: PrecipAmountHeavy,
    moderate: PrecipAmountModerate,
    light: PrecipAmountLight,
    trace: PrecipAmountTrace,
    none: PrecipAmountNone,
  },
  storm: {
    strong: StormStrong,
    moderate: StormModerate,
    weak: StormWeak,
    none: StormNone,
  },
} as const;

/** An icon family (`"sky"`, `"pressure"`, …). */
export type IconFamily = keyof typeof ICONS;

/** The valid icon keys for a given family — correlated, so a wrong key is a compile error. */
export type IconKey<F extends IconFamily> = keyof (typeof ICONS)[F];

interface WeatherIconProps<F extends IconFamily> {
  family: F;
  icon: IconKey<F>;
}

/**
 * Renders one themed weather SVG for a given `(family, icon)` pair. Generic over the family so `icon` is
 * constrained to that family's keys — passing an icon from another family is a compile error. Always
 * `aria-hidden`: the icon is decorative; the Data-panel row's text/value is the accessible channel.
 */
export function WeatherIcon<F extends IconFamily>({ family, icon }: WeatherIconProps<F>) {
  const familyIcons = ICONS[family] as Record<string, ComponentType<SVGProps<SVGSVGElement>>>;
  const Icon = familyIcons[icon as string];
  return <Icon aria-hidden="true" focusable="false" />;
}
