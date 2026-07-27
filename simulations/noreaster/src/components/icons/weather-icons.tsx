import type { ComponentType, SVGProps } from "react";

// Weather-outcome icons. Themed via `currentColor` — the consumer (`.wo-icon`) supplies
// `color: theme.$icon-color` — EXCEPT the deliberately fixed fills in the source SVGs:
// `sky-sunny` and the sun in `sky-clearing-breezy` are gold (#B08C00), and `wind-variable`
// uses `currentColor`-based gradients. Do not normalize those fills.
//
// svgr keeps svgo OFF (per the shared build), so SVG element ids are inlined verbatim, not uniquified.
// Keep any gradient ids collision-safe (e.g. `wind-variable`'s `wv-*` prefix) — a duplicate id shared by
// two icons rendered together would cross-reference the wrong <defs>.
import PrecipAmountHeavy from "../../assets/icons/weather/precip-amount-heavy.svg?react";
import PrecipAmountLight from "../../assets/icons/weather/precip-amount-light.svg?react";
import PrecipAmountModerate from "../../assets/icons/weather/precip-amount-moderate.svg?react";
import PrecipAmountNone from "../../assets/icons/weather/precip-amount-none.svg?react";
import PrecipAmountTrace from "../../assets/icons/weather/precip-amount-trace.svg?react";
import PrecipTypeLightRain from "../../assets/icons/weather/precip-type-light-rain.svg?react";
import PrecipTypeNone from "../../assets/icons/weather/precip-type-none.svg?react";
import PrecipTypeRain from "../../assets/icons/weather/precip-type-rain.svg?react";
import PrecipTypeStrayShower from "../../assets/icons/weather/precip-type-stray-shower.svg?react";
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
import WindNwLow from "../../assets/icons/weather/wind-nw-low.svg?react";
import WindSseLight from "../../assets/icons/weather/wind-sse-light.svg?react";
import WindVariable from "../../assets/icons/weather/wind-variable.svg?react";

/**
 * The weather-icon registry: `ICONS[family][key]` → the SVG React component. `OUTCOME_ICONS`
 * (outcome-icons.ts) references these keys, and the `IconKey` type below makes an invalid `(family, key)`
 * pair a compile error.
 *
 * A key names the icon ART, not the current label — some are historic on purpose (matching the
 * prototype's registry): `sky.clearingBreezy` now backs "Clear, breezy" and `precipType.strayShower`
 * backs "Scattered rain".
 */
export const ICONS = {
  sky: {
    sunny: SkySunny,
    overcast: SkyOvercast,
    cloudy: SkyCloudy,
    overcastHazy: SkyOvercastHazy,
    clearingBreezy: SkyClearingBreezy,
  },
  wind: {
    neHigh: WindNeHigh,
    neMedium: WindNeMedium,
    neLow: WindNeLow,
    nwLow: WindNwLow,
    sseLight: WindSseLight,
    variable: WindVariable,
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

/** An icon family (`"sky"`, `"wind"`, …). */
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
