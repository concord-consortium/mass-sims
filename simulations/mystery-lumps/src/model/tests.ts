export type TestId = "handle" | "waft" | "water" | "vinegar" | "bath" | "lamp";

/** Bath temperatures in °C, and lamp exposures, as the dropdowns offer them. */
export type BathTemp = "20" | "40" | "60" | "80";
export type Exposure = "seconds" | "hour" | "day" | "fortnight";
export type SettingId = BathTemp | Exposure;

export interface SettingOption {
  id: SettingId;
  label: string;
}

export interface TestMeta {
  label: string;
  /** Whether running it uses up the lump's one shot. Handling and wafting do not. */
  consumes: boolean;
  /** Empty when the test has no dial; the Setting dropdown disables itself then. */
  settings: readonly SettingOption[];
}

const BATH_TEMPS: readonly SettingOption[] = [
  { id: "20", label: "20 °C" },
  { id: "40", label: "40 °C" },
  { id: "60", label: "60 °C" },
  { id: "80", label: "80 °C" },
];

const EXPOSURES: readonly SettingOption[] = [
  { id: "seconds", label: "A few seconds" },
  { id: "hour", label: "An hour" },
  { id: "day", label: "A day" },
  { id: "fortnight", label: "Two weeks" },
];

export const TESTS: Record<TestId, TestMeta> = {
  handle: { label: "Handle", consumes: false, settings: [] },
  waft: { label: "Waft", consumes: false, settings: [] },
  water: { label: "Water", consumes: true, settings: [] },
  vinegar: { label: "Vinegar", consumes: true, settings: [] },
  bath: { label: "Warm bath", consumes: true, settings: BATH_TEMPS },
  lamp: { label: "UV lamp", consumes: true, settings: EXPOSURES },
};

/** The tests the settings grid offers — the destructive four, in the design's order. */
export const CONSUMING_TESTS = [
  "water",
  "vinegar",
  "bath",
  "lamp",
] as const satisfies readonly TestId[];
