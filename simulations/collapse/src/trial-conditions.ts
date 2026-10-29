/** The four fixed trials, in display order. */
export const COLLAPSE_TRIAL_LETTERS = ["A", "B", "C", "D"] as const;
export type CollapseTrialLetter = (typeof COLLAPSE_TRIAL_LETTERS)[number];

export type RockType = "Limestone" | "Granite";
export type Moisture = "Wet" | "Dry";

/** What each moisture level means: `text` for the card, `spoken` for its screen-reader label. */
export const MOISTURE_NOTES: Record<Moisture, { text: string; spoken: string }> = {
  Dry: { text: "<10 rainy days/yr", spoken: "under 10 rainy days a year" },
  Wet: { text: ">50 rainy days/yr", spoken: "more than 50 rainy days a year" },
};

/** Each trial's fixed conditions. `takeSample` passes them to the erosion model; they are not stored per trial. */
export const TRIAL_CONDITIONS: Record<CollapseTrialLetter, { rock: RockType; moisture: Moisture }> =
  {
    A: { rock: "Limestone", moisture: "Dry" },
    B: { rock: "Limestone", moisture: "Wet" },
    C: { rock: "Granite", moisture: "Dry" },
    D: { rock: "Granite", moisture: "Wet" },
  };
