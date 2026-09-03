// Collapse — a data-generation mock. The student picks one of four environments (terrain ×
// weather) and samples points in time; each sample adds a row (with a tiny landscape cross-section)
// to that environment's table. Rows feed a comparative table and a free-axis graph.
//
// The "physics" is a deliberate mock: erosion proceeds at a terrain/weather-specific rate with a
// small per-measurement variation, and soluble (limestone) terrain puts dissolved rock into the
// groundwater in proportion to that rate. Granite barely erodes and dissolves nothing (but holds
// water).

export type Terrain = "limestone" | "granite";
export type Weather = "wet" | "dry";
export type ComboId = "limestone-wet" | "limestone-dry" | "granite-wet" | "granite-dry";

export interface Combo {
  id: ComboId;
  terrain: Terrain;
  weather: Weather;
  name: string; // e.g. "Limestone · Wet"
}

export const COMBOS: Combo[] = [
  { id: "limestone-wet", terrain: "limestone", weather: "wet", name: "Limestone · Wet" },
  { id: "limestone-dry", terrain: "limestone", weather: "dry", name: "Limestone · Dry" },
  { id: "granite-wet", terrain: "granite", weather: "wet", name: "Granite · Wet" },
  { id: "granite-dry", terrain: "granite", weather: "dry", name: "Granite · Dry" },
];
export const COMBO_IDS: ComboId[] = COMBOS.map((c) => c.id);
export const comboById = (id: ComboId): Combo => COMBOS.find((c) => c.id === id) ?? COMBOS[0];

// Per-factor label + icon (placeholder emoji until the UX team supplies real art).
export const TERRAIN_META: Record<Terrain, { label: string; icon: string }> = {
  limestone: { label: "Limestone", icon: "🪨" },
  granite: { label: "Granite", icon: "⛰️" },
};
export const WEATHER_META: Record<Weather, { label: string; icon: string }> = {
  wet: { label: "Wet", icon: "🌧️" },
  dry: { label: "Dry", icon: "☀️" },
};

export interface EnvProfile {
  /** Erosion rate, mm per 1000 years (the mean; each measurement varies ±15%). */
  baseRate: number;
  soluble: boolean;
  /** Dissolved rock (mg/L) at the base rate; scales with the measured rate. */
  dissolvedAtBase: number;
  baseWaterPct: number;
  baseAirPct: number;
}

/** Terrain sets the mechanism (soluble + rate scale); weather scales rate and pore water. */
export function envProfile(id: ComboId): EnvProfile {
  const { terrain, weather } = comboById(id);
  const wet = weather === "wet";
  if (terrain === "limestone") {
    return {
      baseRate: wet ? 30 : 20,
      soluble: true,
      dissolvedAtBase: 264,
      baseWaterPct: wet ? 32 : 14,
      baseAirPct: wet ? 8 : 26,
    };
  }
  // granite barely erodes and never dissolves, but still holds groundwater
  return {
    baseRate: 2,
    soluble: false,
    dissolvedAtBase: 0,
    baseWaterPct: wet ? 34 : 24,
    baseAirPct: wet ? 6 : 14,
  };
}

/** Factual definition of the weather setting (not a spoiler) — shown under the table header. */
export function weatherDefinition(weather: Weather): string {
  return weather === "wet" ? "> 50 rainy days / year" : "< 10 rainy days / year";
}

export const COMBO_BLURB: Record<ComboId, string> = {
  "limestone-wet":
    "Rain over soluble limestone dissolves rock away in the groundwater — caves and karst form fastest.",
  "limestone-dry":
    "Same soluble rock, but little water — erosion and dissolving go much more slowly.",
  "granite-wet":
    "Granite barely erodes and won't dissolve — no caves — though the ground holds water.",
  "granite-dry": "Granite, and little rain: almost no erosion, and no dissolved rock.",
};

/** How far before the collapse a student can sample — the timeline/stepper range. */
export const COLLAPSE_SPAN_YEARS = 100_000;

/**
 * The cavern is older than the samplable window: it has been eroding for this many years by the time
 * of the collapse. So even the oldest sample (COLLAPSE_SPAN_YEARS before collapse) already shows a
 * partly-formed cavern, and the depth reaches its full extent at the collapse — without changing the
 * erosion rate. (elapsed = KARST_AGE_AT_COLLAPSE − yearsBeforeCollapse.)
 */
export const KARST_AGE_AT_COLLAPSE = 200_000;

/** The collapse happened in 2014; the timeline's "now" is 2026 — so 0 years-before-collapse sits
 *  this many years back from the right (present-day) end, not at it. */
export const COLLAPSE_YEAR = 2014;
export const PRESENT_YEAR = 2026;
export const YEARS_SINCE_COLLAPSE = PRESENT_YEAR - COLLAPSE_YEAR;
export const DEFAULT_YEARS_BEFORE = 100_000;
export const YEAR_STEP = 1_000;

/** Per-measurement variation applied to the erosion rate (±15%). */
export const RATE_VARIATION = 0.15;

export interface SampleRow {
  id: string;
  combo: ComboId;
  /** Years before the collapse this sample was taken (0 = at collapse). */
  yearsBeforeCollapse: number;
  erosionRate: number; // mm per 1000 yr (steady, ±15% per measurement)
  erodedDepth: number; // accumulated mm removed by now (the cavern depth)
  dissolvedRock: number; // mg/L per 1000 yr
  pctAir: number; // %
  pctWater: number; // %
}

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

/**
 * Generate one measured row for a combo at a given "years before collapse". Erosion accumulates
 * over elapsed time, so a sample further before the collapse shows *less* erosion. `rng` is
 * injectable for tests; in the app each call draws fresh so re-sampling the same year gives a
 * genuinely different measurement (the ±15% variation).
 */
export function generateRow(
  combo: ComboId,
  yearsBeforeCollapse: number,
  rng: () => number = Math.random,
): SampleRow {
  const e = envProfile(combo);
  const jitter = (amount: number) => 1 + (rng() * 2 - 1) * amount;

  const elapsed = Math.max(0, KARST_AGE_AT_COLLAPSE - yearsBeforeCollapse); // years of erosion so far
  const erosionRate = e.baseRate * jitter(RATE_VARIATION); // noisy per-measurement rate (mm/1000yr)
  // Total depth is erosion integrated over all past time, so the ±15% measurement noise averages
  // out — use the mean rate. This keeps depth monotonic: a sample further in the past is never
  // reported deeper than a later one.
  const erodedDepth = (e.baseRate / 1000) * elapsed; // accumulated mm (the cavern depth)
  const dissolvedRock = e.soluble ? e.dissolvedAtBase * (erosionRate / e.baseRate) : 0; // mg/L per 1000 yr
  const pctWater = clampPct(e.baseWaterPct * jitter(0.1));
  const pctAir = clampPct(e.baseAirPct * jitter(0.1));

  return {
    id: Math.random().toString(36).slice(2, 10),
    combo,
    yearsBeforeCollapse,
    erosionRate,
    erodedDepth,
    dissolvedRock,
    pctAir,
    pctWater,
  };
}

// ---- Columns ------------------------------------------------------------------------------

export type ColumnId = "erosionRate" | "dissolvedRock" | "totalDepth" | "pctAir" | "pctWater";

export interface ColumnDef {
  id: ColumnId;
  label: string;
  unit: string;
  decimals: number;
  get: (r: SampleRow) => number;
}

export const COLUMNS: ColumnDef[] = [
  // Erosion rate and dissolved rock are steady per-1000-year measurements (constant ±15%);
  // total depth accumulates over time, reaching ~6 m at 200,000 yr.
  {
    id: "erosionRate",
    label: "Erosion rate",
    unit: "mm/1000 yr",
    decimals: 0,
    get: (r) => r.erosionRate,
  },
  {
    id: "dissolvedRock",
    label: "Dissolved rock",
    unit: "mg/L / 1000 yr",
    decimals: 0,
    get: (r) => r.dissolvedRock,
  },
  { id: "totalDepth", label: "Total depth", unit: "mm", decimals: 0, get: (r) => r.erodedDepth },
  { id: "pctAir", label: "% air in soil", unit: "%", decimals: 1, get: (r) => r.pctAir },
  { id: "pctWater", label: "% water in soil", unit: "%", decimals: 1, get: (r) => r.pctWater },
];

/** The fixed data columns shown in every table and offered on the graph's y axis — not pickable or
 *  reorderable. (The x axis is always "Years before collapse".) */
export const FIXED_COLUMN_IDS: ColumnId[] = ["erosionRate", "dissolvedRock", "totalDepth"];

/** Columns usable on a graph axis: the Year, plus every data column. */
export interface AxisDef {
  id: "yearsBeforeCollapse" | ColumnId;
  label: string;
  unit: string;
  get: (r: SampleRow) => number;
}
export const AXES: AxisDef[] = [
  {
    id: "yearsBeforeCollapse",
    label: "Years before collapse",
    unit: "yr",
    get: (r) => r.yearsBeforeCollapse,
  },
  ...COLUMNS.map((c) => ({ id: c.id, label: c.label, unit: c.unit, get: c.get })),
];

/** Formats a cell value; the unit lives in the column header, so it's not repeated here. */
export function formatValue(col: { decimals: number }, value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: col.decimals,
    maximumFractionDigits: col.decimals,
  });
}

// ---- Summary statistics -------------------------------------------------------------------

export type StatId = "average" | "sum" | "max" | "min";
export const STATS: { id: StatId; label: string }[] = [
  { id: "average", label: "Average" },
  { id: "sum", label: "Sum" },
  { id: "max", label: "Maximum" },
  { id: "min", label: "Minimum" },
];

export function computeStat(stat: StatId, values: number[]): number {
  if (values.length === 0) return 0;
  switch (stat) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "max":
      return Math.max(...values);
    case "min":
      return Math.min(...values);
    default:
      return values.reduce((a, b) => a + b, 0) / values.length;
  }
}

// ---- Timeline eras ------------------------------------------------------------------------
// Reference points so the student can feel the scale of the sampled span. Rendered on a log axis
// so half a billion years and thirty years both fit legibly.

export interface EraMarker {
  label: string;
  yearsAgo: number;
  icon: string; // placeholder emoji until real art lands
}
export const ERA_MARKERS: EraMarker[] = [
  { label: "Last Ice Age", yearsAgo: 20_000, icon: "❄️" },
  { label: "Pyramids built", yearsAgo: 4_600, icon: "🔺" },
  { label: "Industrial age", yearsAgo: 250, icon: "🏭" },
  { label: "Corvette Museum", yearsAgo: 30, icon: "🚗" },
];

// The timeline runs from 100,000 years ago (oldest, left) to today (right); the sampled span
// (up to COLLAPSE_SPAN_YEARS) fills it. Log-scaled so both ends read legibly.
export const TIMELINE_MIN_YEARS = 10;
export const TIMELINE_MAX_YEARS = 100_000;

/** Position (0 = left/oldest … 1 = right/most recent) of a "years ago" value on the log timeline. */
export function timelinePosition(yearsAgo: number): number {
  const y = Math.max(TIMELINE_MIN_YEARS, Math.min(TIMELINE_MAX_YEARS, yearsAgo));
  const lo = Math.log10(TIMELINE_MIN_YEARS);
  const hi = Math.log10(TIMELINE_MAX_YEARS);
  const norm = (Math.log10(y) - lo) / (hi - lo); // 0 recent … 1 old
  return 1 - norm; // flip so oldest is on the left
}

/** Inverse of timelinePosition: the "years ago" at a horizontal position (0 = left/oldest … 1 = right). */
export function yearsAgoAtPosition(pos: number): number {
  const p = Math.max(0, Math.min(1, pos));
  const lo = Math.log10(TIMELINE_MIN_YEARS);
  const hi = Math.log10(TIMELINE_MAX_YEARS);
  const norm = 1 - p; // undo the "oldest on the left" flip
  return 10 ** (norm * (hi - lo) + lo);
}

/**
 * Log-spaced sampling grid (years before collapse). A fixed linear step feels jarring on the log
 * timeline — 1,000 years is nearly half the axis near the present but a sliver near the oldest end — so
 * the timeline, stepper, and keyboard all move through these values, giving roughly even visual spacing.
 */
export const SAMPLE_YEARS_BEFORE: number[] = [
  0, 10, 20, 50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000,
];

/** Snap a years-before-collapse value to the nearest grid value, measured on the log timeline. */
export function snapToSampleGrid(yearsBefore: number): number {
  const target = timelinePosition(yearsBefore + YEARS_SINCE_COLLAPSE);
  let best = SAMPLE_YEARS_BEFORE[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const v of SAMPLE_YEARS_BEFORE) {
    const d = Math.abs(timelinePosition(v + YEARS_SINCE_COLLAPSE) - target);
    if (d < bestDist) {
      bestDist = d;
      best = v;
    }
  }
  return best;
}

/** Step to the adjacent grid value (dir +1 = older / more years before, −1 = more recent / fewer). */
export function stepSampleYear(current: number, dir: 1 | -1): number {
  let idx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  SAMPLE_YEARS_BEFORE.forEach((v, i) => {
    const d = Math.abs(v - current);
    if (d < bestDist) {
      bestDist = d;
      idx = i;
    }
  });
  const next = Math.max(0, Math.min(SAMPLE_YEARS_BEFORE.length - 1, idx + dir));
  return SAMPLE_YEARS_BEFORE[next];
}

/**
 * Years-before-collapse for a click at horizontal position `pos` (0…1) on the timeline — the inverse of
 * the sample marker's placement, snapped to the log-spaced grid so clicks land on nice values with even
 * visual spacing.
 */
export function yearsBeforeAtPosition(pos: number): number {
  return snapToSampleGrid(yearsAgoAtPosition(pos) - YEARS_SINCE_COLLAPSE);
}
