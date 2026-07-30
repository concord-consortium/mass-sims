import type { LandPathway, OceanPathway } from "../model/weather";

/**
 * Arrow convergence geometry. Pure and unit-tested; the runner (`use-storm-run`) drives the per-frame
 * tween off these constants.
 *
 * Everything lives in ONE coordinate basis: the arrow's TOP-LEFT in `.nor-map` pixel space (the fixed
 * 2:1 overlay frame). The target is the storm start-center minus the arrow's tip offset (so its *tip*,
 * not its origin, reaches the center) plus a per-arrow nudge, so the runner's translate is a
 * top-left-to-top-left delta.
 */

/** Circled map number per pathway: N/NW → 1, W → 4 (land); S/SE → 2, NE → 3 (ocean). */
const NOR_PATH_NUM: Record<LandPathway | OceanPathway, number> = {
  "N/NW": 1,
  W: 4,
  "S/SE": 2,
  NE: 3,
};

/** The arrow numbers that converge into the storm — the two selected pathways. */
export function convergedArrows(
  landPathway: LandPathway | null,
  oceanPathway: OceanPathway | null,
): number[] {
  const nums: number[] = [];
  if (landPathway) nums.push(NOR_PATH_NUM[landPathway]);
  if (oceanPathway) nums.push(NOR_PATH_NUM[oceanPathway]);
  return nums;
}

// ─── Prototype constants ─────────────────────────────────────────────────────────────────────────────
/** Storm start-center offset from the map center. */
const NOR_START_OFF = { x: -18, y: 36 };
/** Arrows are authored in a ~265-tall unit space; `scale = frameHeight / 265`. */
const ARROW_UNIT_HEIGHT = 265;
/** Per-arrow tip anchor (subtracted × scale so the tip, not the origin, lands on the storm center). */
const ARROW_TIP: Record<number, { tx: number; ty: number }> = {
  1: { tx: 155, ty: 156 },
  2: { tx: 0, ty: 0 },
  3: { tx: 0, ty: 172 },
  4: { tx: 219, ty: 38 },
};
/** Per-arrow final nudge (px, unscaled). */
const ARROW_NUDGE: Record<number, { x: number; y: number }> = {
  1: { x: 7, y: -12 },
  2: { x: -8, y: 14 },
  3: { x: 15, y: 7 },
  4: { x: -5, y: 12 },
};
/** Per-arrow total rotation (deg) at the end of the tween; ramps linearly with `t`. */
const ARROW_ROTATE: Record<number, number> = { 1: 7, 2: 8, 3: 8, 4: -6 };

/** The measured `.nor-map` overlay frame (its content box), in CSS px. */
export interface Frame {
  width: number;
  height: number;
}

/**
 * The target TOP-LEFT (in `.nor-map` px) an arrow's local origin converges to: the storm start-center,
 * tip-anchored and nudged. The runner tweens each arrow from its measured current top-left to this.
 */
export function convergenceTarget(num: number, frame: Frame): { x: number; y: number } {
  const sh = frame.height;
  // The overlay reference frame: the original map footprint at stage height, centered. `.nor-map` is a
  // 2:1 box, so imgLeft ≈ 0 — but derive it so a non-exact frame stays faithful.
  const imgW = sh * (2667 / 1334);
  const imgLeft = (frame.width - imgW) / 2;
  const scale = sh / ARROW_UNIT_HEIGHT;
  const stormX = imgLeft + imgW / 2 + NOR_START_OFF.x;
  const stormY = sh / 2 + NOR_START_OFF.y;
  // Fall back for an unknown arrow number, matching `convergenceRotation`'s `?? 0` (the tables are keyed
  // 1–4 but typed over all numbers). Unreachable today — callers only pass `convergedArrows` output.
  const tip = ARROW_TIP[num] ?? { tx: 0, ty: 0 };
  const nudge = ARROW_NUDGE[num] ?? { x: 0, y: 0 };
  return { x: stormX - tip.tx * scale + nudge.x, y: stormY - tip.ty * scale + nudge.y };
}

/** Total rotation (deg) an arrow reaches at the end of the convergence (0 for an unknown number). */
export function convergenceRotation(num: number): number {
  return ARROW_ROTATE[num] ?? 0;
}

/**
 * Opacity fade over convergence progress `t ∈ [0,1]`: full for the first half, then linear to 0 over the
 * second, so the arrow is invisible by the time it reaches the storm center.
 */
export function convergenceFade(t: number): number {
  return t < 0.5 ? 1 : Math.max(0, 1 - (t - 0.5) / 0.5);
}
