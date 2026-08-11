import { describe, expect, it } from "vitest";
import { OUTCOMES, type Outcome } from "../model/weather";
import { NO_SCENE, SCENES, type ScenePlayer } from "./weather-scenes";

/**
 * `SCENES` is a data table parallel to `OUTCOME_VALUES`/`OUTCOME_ICONS`. These specs guard the mapping so a
 * drift — a new outcome without a scene, a snow mode swap, a gust scalar edit — fails here rather than
 * silently changing the animation. Asserting the `stormMode` MAPPING (not merely 1 > 0.68 > 0.3) is what
 * protects the three distinct per-mode precipitation behaviors.
 */
describe("SCENES", () => {
  it("has a scene for every outcome (exhaustive)", () => {
    for (const outcome of OUTCOMES) {
      expect(SCENES[outcome]).toBeDefined();
    }
    // No extra keys beyond the model's outcomes.
    expect(Object.keys(SCENES).sort()).toEqual([...OUTCOMES].sort());
  });

  it("maps each non-snow outcome to its expected player", () => {
    const expected: Record<Outcome, ScenePlayer> = {
      strong: "snow",
      moderate: "snow",
      weakCoastal: "snow",
      humidNoStorm: "haze",
      windy: "windyBreezy",
      fair: "sunRays",
    };
    for (const outcome of OUTCOMES) {
      expect(SCENES[outcome].player).toBe(expected[outcome]);
    }
  });

  it("maps the three snow outcomes to their distinct storm modes", () => {
    // The primary snow input is the MODE, which selects particle type / angle / speed / base spawn — not a
    // single scaled effect.
    expect(SCENES.strong.stormMode).toBe("strong");
    expect(SCENES.moderate.stormMode).toBe("moderate");
    expect(SCENES.weakCoastal.stormMode).toBe("weak");
  });

  it("carries the per-mode gust scalars (snowIntensity, gust-only)", () => {
    // snowIntensity scales GUSTS only (timing/count/force), not base spawn/angle/speed.
    expect(SCENES.strong.snowIntensity).toBe(1);
    expect(SCENES.moderate.snowIntensity).toBe(0.68);
    expect(SCENES.weakCoastal.snowIntensity).toBe(0.3);
  });

  it("marks only the storm-gray scenes dark (drives the heading treatment)", () => {
    // Four storm-gray scenes are dark; the warm `windy`/`fair` scenes are light.
    expect(SCENES.strong.dark).toBe(true);
    expect(SCENES.moderate.dark).toBe(true);
    expect(SCENES.weakCoastal.dark).toBe(true);
    expect(SCENES.humidNoStorm.dark).toBe(true);
    expect(SCENES.windy.dark).toBe(false);
    expect(SCENES.fair.dark).toBe(false);
  });
});

describe("NO_SCENE", () => {
  it("is an inert, light scene (outcome === null)", () => {
    expect(NO_SCENE.player).toBe("none");
    expect(NO_SCENE.dark).toBe(false);
  });
});
