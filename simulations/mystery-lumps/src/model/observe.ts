import type { SubstanceId } from "./substances";
import type { TestId } from "./tests";
import type { LumpRecord } from "./trial";

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

/**
 * Always two weeks under the lamp, long enough for both substances that break down under UV to
 * do so: palm oil, already part-oxidized, goes rancid, and refined paraffin yellows.
 */
function underLamp(substance: SubstanceId): Observation {
  if (substance === "sea-glass") {
    return { caption: "The lump shines with a pale blue-white glow.", visual: "glowing" };
  }
  if (substance === "palm-oil") {
    return {
      caption: "The lump glows a dull yellow-green. Its surface looks damp and darkened.",
      visual: "glowing",
    };
  }
  if (substance === "paraffin") {
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

  const outcome = observe(substance, prior.test);
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
      // Glowing alone changes nothing you can feel; what the fortnight did to palm oil does.
      return substance === "palm-oil"
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
  const degraded = substance === "palm-oil" && prior?.test === "lamp";
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
 * broken it down. The four destructive tests ignore it, since a lump only ever
 * gets one of them.
 */
export function observe(
  substance: SubstanceId,
  test: TestId,
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
      return underLamp(substance);
  }
}

/**
 * What the scale reads once a lump's test is over. A melted or softened lump weighs what it did:
 * the material is all still there, just in another shape.
 */
export function massAfter(substance: SubstanceId, test: TestId, before: number): number {
  switch (observe(substance, test).visual) {
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

/**
 * The lump as it was last seen: its test's end state if it has one, otherwise what examining
 * it revealed, otherwise the anonymous blob every unexamined lump shares.
 */
export function lastSeen(substance: SubstanceId, record: LumpRecord): VisualKey | "unknown" {
  if (record.result) return observe(substance, record.result.test).visual;
  return record.examined.before ? examine(substance).visual : "unknown";
}
