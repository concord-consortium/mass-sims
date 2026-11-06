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
  | "degrading"
  | "rancid"
  | "no-smell";

export interface Observation {
  /** Describes what happens. Never names a substance or a class of substance. */
  caption: string;
  visual: VisualKey;
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
  },
  // The two hard lumps and the two waxy lumps are deliberately word-for-word identical:
  // handling sorts them into pairs and must never split a pair.
  seashell: {
    caption: "Hard and smooth, cool to the touch.",
    visual: "hard-smooth",
  },
  "sea-glass": {
    caption: "Hard and smooth, cool to the touch.",
    visual: "hard-smooth",
  },
  paraffin: {
    caption: "Waxy and pale. It gives a little under a fingernail.",
    visual: "waxy",
  },
  "palm-oil": {
    caption: "Waxy and pale. It gives a little under a fingernail.",
    visual: "waxy",
  },
};

/**
 * The two substances that break down under UV do so on different clocks: palm oil, already
 * part-oxidized, turns rancid within a day, while refined paraffin needs the full fortnight
 * before it yellows. One shared threshold would hand the student paraffin a day early.
 */
const RANCID_EXPOSURES = new Set(["day", "fortnight"]);
const PARAFFIN_DECAY_EXPOSURE = "fortnight";

/**
 * Vinegar notes say the container is open: it is why the fizzing shell weighs less afterwards,
 * since the gas escapes rather than staying on the scale.
 */
function inVinegar(substance: SubstanceId): Observation {
  const outcome = inWater(substance, true);
  return { ...outcome, caption: `In an open container. ${outcome.caption}` };
}

function inWater(substance: SubstanceId, vinegar: boolean): Observation {
  if (substance === "sea-salt") {
    return {
      caption: vinegar
        ? "The lump shrinks away to nothing. No bubbles."
        : "The lump shrinks away to nothing. The water stays clear.",
      visual: "dissolving",
    };
  }
  if (vinegar && substance === "seashell") {
    return {
      caption: "A steady stream of small bubbles rises from the lump.",
      visual: "fizzing",
    };
  }
  return { caption: NOTHING, visual: "none" };
}

/** °C. One bath run warms the same lump through each in turn and reports every step. */
export const BATH_STEPS = [30, 45, 80] as const;

/** °C. Only the two waxes melt in the bath's range, and palm oil goes well before paraffin. */
const MELTING_POINT: Partial<Record<SubstanceId, number>> = { "palm-oil": 40, paraffin: 60 };

/** How each wax goes, softening first, at the step where it reaches its melting point. */
const MELTS: Partial<Record<SubstanceId, string>> = {
  "palm-oil": "the lump softens and slumps, then runs into a pool at the bottom of the dish.",
  paraffin: "the lump turns glossy and soft, sags, then melts into a clear pool in the dish.",
};

/** Which of the bath's steps the lump melts at, or null if it never does. */
export function bathMeltStep(substance: SubstanceId): number | null {
  const point = MELTING_POINT[substance];
  if (point === undefined) return null;
  const step = BATH_STEPS.findIndex((temp) => temp >= point);
  return step < 0 ? null : step;
}

/**
 * The lump sits in a dry dish inside the bath, so only heat reaches it — which is why salt,
 * dissolving in every other liquid test, does nothing here.
 */
function inBath(substance: SubstanceId): Observation {
  const melt = bathMeltStep(substance);
  const steps = BATH_STEPS.map((temp, i) => {
    const change =
      melt === null || i < melt
        ? "nothing changes."
        : i === melt
          ? MELTS[substance]
          : "the pool stays liquid.";
    return `At ${temp} °C, ${change}`;
  });
  return {
    caption: `In a dry dish inside the bath. ${steps.join(" ")}`,
    visual: melt === null ? "none" : "melting",
  };
}

function underLamp(substance: SubstanceId, setting: SettingId | null): Observation {
  const exposure = String(setting ?? "seconds");
  if (substance === "sea-glass") {
    return { caption: "The lump shines with a pale blue-white glow.", visual: "glowing" };
  }
  if (substance === "palm-oil") {
    return {
      caption: RANCID_EXPOSURES.has(exposure)
        ? "The lump glows a dull yellow-green. Its surface looks damp and darkened."
        : "The lump glows a dull yellow-green.",
      visual: "glowing",
    };
  }
  if (substance === "paraffin" && exposure === PARAFFIN_DECAY_EXPOSURE) {
    return {
      caption:
        "The lump has turned yellow, its surface is powdery, and a corner has crumbled away.",
      visual: "degrading",
    };
  }
  return { caption: "The lump stays dark. Nothing changes.", visual: "none" };
}

/**
 * Handling a lump that has already been through a test describes what is there *now*, not what
 * was there before. The prior test's own outcome says what happened to it, so this reads that
 * rather than keeping a second table in step with the first.
 */
function handled(substance: SubstanceId, prior: PriorResult | null): Observation {
  // Only a destructive test is ever stored as a result, but guard anyway: handling or wafting
  // changes nothing, so there would be nothing new to describe.
  if (!prior || prior.test === "handle" || prior.test === "waft") return HANDLE[substance];

  const outcome = observe(substance, prior.test, prior.setting);
  switch (outcome.visual) {
    case "dissolving":
      return { caption: "There is nothing left to pick up.", visual: "dissolving" };
    case "melting":
      return { caption: "A shallow, greasy pool. It smears under a finger.", visual: "melting" };
    case "degrading":
      return {
        caption: "Dry and brittle. It leaves a chalky powder on your fingers.",
        visual: "degrading",
      };
    case "fizzing":
      return {
        caption: "Rougher than it was, and pitted where the bubbles came from.",
        visual: "fizzing",
      };
    case "glowing":
      // Glowing alone changes nothing you can feel; a long exposure does.
      return substance === "palm-oil" && RANCID_EXPOSURES.has(String(prior.setting))
        ? {
            caption: "Greasier than it was, and tacky where the surface has darkened.",
            visual: "glowing",
          }
        : HANDLE[substance];
    default:
      return HANDLE[substance];
  }
}

function waft(substance: SubstanceId, prior: PriorResult | null): Observation {
  const degraded =
    substance === "palm-oil" &&
    prior?.test === "lamp" &&
    RANCID_EXPOSURES.has(String(prior.setting));
  return degraded
    ? { caption: "A sharp, rancid smell.", visual: "rancid" }
    : { caption: "No smell to speak of.", visual: "no-smell" };
}

/**
 * What a student observes. Pure and exhaustive — every fact in the design spec's table lives
 * here and nowhere else, which is why the unit tests point at this function rather than at
 * the components that render it.
 *
 * `prior` is the lump's already-spent test. Handling and wafting both depend on it: a lump that
 * has melted feels like a pool rather than a block, and palm oil smells rancid once the lamp has
 * had long enough to break it down. The four destructive tests ignore it, since a lump only ever
 * gets one of them.
 */
export function observe(
  substance: SubstanceId,
  test: TestId,
  setting: SettingId | null,
  prior: PriorResult | null = null,
): Observation {
  switch (test) {
    case "handle":
      return handled(substance, prior);
    case "waft":
      return waft(substance, prior);
    case "water":
      return inWater(substance, false);
    case "vinegar":
      return inVinegar(substance);
    case "bath":
      return inBath(substance);
    case "lamp":
      return underLamp(substance, setting);
  }
}

/**
 * What the scale reads once a lump's test is over. A melted or softened lump weighs what it did:
 * the material is all still there, just in another shape.
 */
export function massAfter(
  substance: SubstanceId,
  test: TestId,
  setting: SettingId | null,
  before: number,
): number {
  switch (observe(substance, test, setting).visual) {
    case "dissolving":
      return 0;
    // Two minutes of fizzing carries off a little of the shell as gas.
    case "fizzing":
      return Math.round((before - 0.4) * 10) / 10;
    // The corner that crumbled away.
    case "degrading":
      return Math.round(before * 0.96 * 10) / 10;
    default:
      return before;
  }
}

/**
 * Look, feel, smell: one free action, so the caption is the feel and the smell together. The
 * picture is what looking and feeling reveal; a smell has nothing to draw.
 */
export function examine(substance: SubstanceId, prior: PriorResult | null = null): Observation {
  const feel = handled(substance, prior);
  return { caption: `${feel.caption} ${waft(substance, prior).caption}`, visual: feel.visual };
}
