export type TestId = "handle" | "waft" | "water" | "vinegar" | "bath" | "lamp";

export interface TestMeta {
  label: string;
  /** Whether running it uses up the lump's one shot. Handling and wafting do not. */
  consumes: boolean;
}

export const TESTS: Record<TestId, TestMeta> = {
  handle: { label: "Handle", consumes: false },
  waft: { label: "Waft", consumes: false },
  water: { label: "Water", consumes: true },
  vinegar: { label: "Vinegar", consumes: true },
  bath: { label: "Warm bath", consumes: true },
  lamp: { label: "UV lamp", consumes: true },
};

/** The tests the picker offers — the destructive four, in the design's order. */
export const CONSUMING_TESTS = [
  "water",
  "vinegar",
  "bath",
  "lamp",
] as const satisfies readonly TestId[];
