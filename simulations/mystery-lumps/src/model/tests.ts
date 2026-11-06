export type TestId = "handle" | "waft" | "water" | "vinegar" | "bath" | "lamp";

/** Lamp exposures, as the dropdown offers them. The bath has no dial: it steps through its own. */
export type Exposure = "seconds" | "hour" | "day" | "fortnight";
export type SettingId = Exposure;

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
  bath: { label: "Warm bath", consumes: true, settings: [] },
  lamp: { label: "UV lamp", consumes: true, settings: EXPOSURES },
};

/** The tests the settings grid offers — the destructive four, in the design's order. */
export const CONSUMING_TESTS = [
  "water",
  "vinegar",
  "bath",
  "lamp",
] as const satisfies readonly TestId[];
