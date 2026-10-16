import type { SubstanceId } from "./substances";
import type { SettingId, TestId } from "./tests";

/** What a station draws. One per distinct thing a student can see or smell. */
export type VisualKey =
  | "none"
  | "crystals"
  | "hard-smooth"
  | "waxy"
  | "dissolving"
  | "fizzing"
  | "glowing"
  | "melting"
  | "softening"
  | "degrading"
  | "rancid"
  | "no-smell";

export interface Observation {
  /** Describes what happens. Never names a substance or a class of substance. */
  caption: string;
  visual: VisualKey;
  /** The time the four-second animation stands for, stated rather than hidden. */
  elapsed: string;
}

export interface PriorResult {
  test: TestId;
  setting: SettingId | null;
}

const NOTHING = "The lump sits where it was put. Nothing changes.";

const HANDLE: Record<SubstanceId, Observation> = {
  "sea-salt": {
    caption: "A crust of small cube-shaped crystals. They crumble between your fingers.",
    visual: "crystals",
    elapsed: "a few seconds",
  },
  // The two hard lumps and the two waxy lumps are deliberately word-for-word identical:
  // handling sorts them into pairs and must never split a pair.
  seashell: {
    caption: "Hard and smooth, cool to the touch.",
    visual: "hard-smooth",
    elapsed: "a few seconds",
  },
  "sea-glass": {
    caption: "Hard and smooth, cool to the touch.",
    visual: "hard-smooth",
    elapsed: "a few seconds",
  },
  paraffin: {
    caption: "Waxy and pale. It gives a little under a fingernail.",
    visual: "waxy",
    elapsed: "a few seconds",
  },
  "palm-oil": {
    caption: "Waxy and pale. It gives a little under a fingernail.",
    visual: "waxy",
    elapsed: "a few seconds",
  },
};

const EXPOSURE_TIME: Record<string, string> = {
  seconds: "a few seconds",
  hour: "an hour",
  day: "a day",
  fortnight: "two weeks",
};

/**
 * The two substances that break down under UV do so on different clocks: palm oil, already
 * part-oxidized, turns rancid within a day, while refined paraffin needs the full fortnight
 * before it yellows. One shared threshold would hand the student paraffin a day early.
 */
const RANCID_EXPOSURES = new Set(["day", "fortnight"]);
const PARAFFIN_DECAY_EXPOSURE = "fortnight";

function inWater(substance: SubstanceId, vinegar: boolean): Observation {
  if (substance === "sea-salt") {
    return {
      caption: vinegar
        ? "The lump shrinks away to nothing. No bubbles."
        : "The lump shrinks away to nothing. The water stays clear.",
      visual: "dissolving",
      elapsed: "30 seconds",
    };
  }
  if (vinegar && substance === "seashell") {
    return {
      caption: "A steady stream of small bubbles rises from the lump.",
      visual: "fizzing",
      elapsed: "30 seconds",
    };
  }
  return { caption: NOTHING, visual: "none", elapsed: "30 seconds" };
}

function inBath(substance: SubstanceId, setting: SettingId | null): Observation {
  const temp = Number(setting ?? "20");
  const elapsed = "30 seconds";
  if (substance === "sea-salt") {
    return {
      caption:
        temp >= 40
          ? "The lump shrinks away quickly. The water stays clear."
          : "The lump shrinks away slowly. The water stays clear.",
      visual: "dissolving",
      elapsed,
    };
  }
  if (substance === "palm-oil" && temp >= 40) {
    return {
      caption: "The lump slumps, then runs into a pool at the bottom.",
      visual: "melting",
      elapsed,
    };
  }
  if (substance === "paraffin" && temp >= 60) {
    return {
      caption: "The lump turns glossy and sags at the edges, but keeps its shape.",
      visual: "softening",
      elapsed,
    };
  }
  return { caption: NOTHING, visual: "none", elapsed };
}

function underLamp(substance: SubstanceId, setting: SettingId | null): Observation {
  const exposure = String(setting ?? "seconds");
  const elapsed = EXPOSURE_TIME[exposure] ?? "a few seconds";
  if (substance === "sea-glass") {
    return { caption: "The lump shines with a pale blue-white glow.", visual: "glowing", elapsed };
  }
  if (substance === "palm-oil") {
    return {
      caption: RANCID_EXPOSURES.has(exposure)
        ? "The lump glows a dull yellow-green. Its surface looks damp and darkened."
        : "The lump glows a dull yellow-green.",
      visual: "glowing",
      elapsed,
    };
  }
  if (substance === "paraffin" && exposure === PARAFFIN_DECAY_EXPOSURE) {
    return {
      caption:
        "The lump has turned yellow, its surface is powdery, and a corner has crumbled away.",
      visual: "degrading",
      elapsed,
    };
  }
  return { caption: "The lump stays dark. Nothing changes.", visual: "none", elapsed };
}

function waft(substance: SubstanceId, prior: PriorResult | null): Observation {
  const degraded =
    substance === "palm-oil" &&
    prior?.test === "lamp" &&
    RANCID_EXPOSURES.has(String(prior.setting));
  return degraded
    ? { caption: "A sharp, rancid smell.", visual: "rancid", elapsed: "a moment" }
    : { caption: "No smell to speak of.", visual: "no-smell", elapsed: "a moment" };
}

/**
 * What a student observes. Pure and exhaustive — every fact in the design spec's table lives
 * here and nowhere else, which is why the unit tests point at this function rather than at
 * the components that render it.
 *
 * `prior` is the lump's already-spent test, which only wafting depends on: palm oil smells
 * rancid once the lamp has had long enough to break it down, and not before.
 */
export function observe(
  substance: SubstanceId,
  test: TestId,
  setting: SettingId | null,
  prior: PriorResult | null = null,
): Observation {
  switch (test) {
    case "handle":
      return HANDLE[substance];
    case "waft":
      return waft(substance, prior);
    case "water":
      return inWater(substance, false);
    case "vinegar":
      return inWater(substance, true);
    case "bath":
      return inBath(substance, setting);
    case "lamp":
      return underLamp(substance, setting);
  }
}
