import type { Outcome } from "../model/weather";
import { norDebugFlag } from "./nor-debug";

/**
 * The map-area storm particle systems. The constants (seeds, radii, opacities, blur radii, spawn
 * formulas) are tuned to match the approved prototype, so treat them as data, not knobs. Backing store
 * + container positioning are owned by the hook (`use-storm-animation`); a player draws only the
 * particles onto the passed context.
 *
 * Three systems: the differential-rotation spiral (`strong` / `moderate`), the traveling band
 * (`weakCoastal`), and the coastline haze (`humidNoStorm`). `windy` / `fair` render no cloud.
 */

/**
 * Supersampling factor — the artboard backs the 398px display canvas at NOR_SCALE×, and is the single
 * resolution budget (never DPR-multiplied). Lowering it shrinks the canvas and the blur kernels
 * ~quadratically — the highest-leverage perf lever, since the two `blur()` passes dominate the frame
 * cost. All geometry below is NOR_SCALE-relative, so the displayed result is unchanged.
 */
export const NOR_SCALE = 2;
/** Blur-overhang padding, proportional to scale. */
const NOR_PAD = 50 * NOR_SCALE;
/** Fixed padded artboard = 398px display × NOR_SCALE. */
export const NOR_SIZE = 398 * NOR_SCALE;
const NOR_CX = NOR_SIZE / 2;
const NOR_CY = NOR_SIZE / 2;

const NOR_ALPHA = 0.95;
const NOR_OMEGA_MAX = 72;
const NOR_LIFE = 30;

// Container drift: start → end, ease-out 1−(1−t)^1.3.
const OFFSET_START = { x: -23, y: 41 };
const OFFSET_END = { x: 53, y: -61 };
/** The drift delta the band's spawner math is expressed against. */
const DRIFT_DX = OFFSET_END.x - OFFSET_START.x; // 76
const DRIFT_DY = OFFSET_END.y - OFFSET_START.y; // -102

/** Container top-left offset (px) at progress `t` — the ease-out drift shared by all moving systems. */
function driftOffset(t: number): { x: number; y: number } {
  const eased = 1 - (1 - t) ** 1.3;
  return { x: OFFSET_START.x + DRIFT_DX * eased, y: OFFSET_START.y + DRIFT_DY * eased };
}

/**
 * Seeded PRNG (mulberry32). The storm's determinism — the same seed reproduces the same particle field,
 * so `renderFinal` regenerates the animated end frame without a per-trial snapshot.
 */
export function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A detached artboard-sized canvas + its 2D context (null in jsdom, where drawing is a guarded no-op). */
function createOffscreen(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null } {
  const canvas = document.createElement("canvas");
  canvas.width = NOR_SIZE;
  canvas.height = NOR_SIZE;
  return { canvas, ctx: canvas.getContext("2d") };
}

/**
 * Whether Canvas 2D `filter` is usable. Safari / iOS ship it disabled on every version, so it's
 * feature-detected by set-and-read-back — `"filter" in ctx` is a false positive on Safari 18+, where the
 * property exists but assignment is ignored. iPad is a deployment target, and there the `composite` blur
 * falls back to `shadowBlur`.
 */
const CANVAS_FILTER_SUPPORTED = (() => {
  if (typeof document === "undefined") return false;
  const cx = document.createElement("canvas").getContext("2d");
  if (!cx) return false;
  // Require the `filter` accessor on the prototype: where the context lacks it (older iPadOS WebKit), a
  // bare assignment just creates an own property that reads back verbatim, falsely reporting support. Then
  // confirm the assignment actually took.
  if (!("filter" in Object.getPrototypeOf(cx))) return false;
  cx.filter = "blur(1px)";
  return cx.filter === "blur(1px)";
})();

/** Fallback only: draw the sharp source this far off-canvas so only its offset-back blurred shadow lands. */
const SHADOW_FAR = NOR_SIZE * 2;

/**
 * The two-pass composite every system shares: a blurred `brightness(0)` shadow, then a lightly-blurred
 * sharp pass, both from the accumulated offscreen. `shadowBlur`/`sharpBlur` are the per-system radii
 * (× NOR_SCALE); alpha ramps 0.35 → 0.9.
 *
 * Where Canvas 2D `filter` is unavailable (Safari / iPad), each pass is reproduced with the native
 * `shadowBlur`: the source is drawn fully off-canvas and only its offset-back, blurred shadow is kept —
 * black for the shadow pass, a light gray for the sharp pass. The offscreen's tone variation collapses to
 * one tone there (imperceptible through the blur); the accumulated alpha silhouette is kept.
 */
function composite(
  ctx: CanvasRenderingContext2D,
  off: HTMLCanvasElement,
  shadowBlur: number,
  sharpBlur: number,
  t: number,
): void {
  const shadowAlpha = 0.35 + t * 0.55;
  // `__norNoFilter` forces the fallback so it can be previewed on a filter-capable device.
  if (CANVAS_FILTER_SUPPORTED && !norDebugFlag("__norNoFilter")) {
    ctx.save();
    ctx.filter = `blur(${shadowBlur * NOR_SCALE}px) brightness(0)`;
    ctx.globalAlpha = shadowAlpha;
    ctx.drawImage(off, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.filter = `blur(${sharpBlur * NOR_SCALE}px)`;
    ctx.drawImage(off, 0, 0);
    ctx.restore();
    return;
  }
  // shadowBlur fallback: each pass is a shadow-only blit — the sharp source sits off-canvas at
  // -SHADOW_FAR, its shadow offset back onto [0, NOR_SIZE]. Dark shadow behind, light sharp body in front.
  ctx.save();
  ctx.globalAlpha = shadowAlpha;
  ctx.shadowColor = "rgba(0,0,0,1)";
  ctx.shadowBlur = shadowBlur * NOR_SCALE;
  ctx.shadowOffsetX = SHADOW_FAR;
  ctx.drawImage(off, -SHADOW_FAR, 0);
  ctx.restore();
  ctx.save();
  ctx.shadowColor = "rgba(245,245,245,1)";
  ctx.shadowBlur = sharpBlur * NOR_SCALE;
  ctx.shadowOffsetX = SHADOW_FAR;
  ctx.drawImage(off, -SHADOW_FAR, 0);
  ctx.restore();
}

/** One frame of a storm system, plus its container drift and the deterministic final frame. */
export interface StormPlayer {
  /**
   * Re-seed the particle system to its deterministic initial state. A replay reuses the cached instance,
   * so this must run at each run start, or `step` would continue from the prior run's particles instead
   * of growing from nothing.
   */
  reset(): void;
  /** Advance physics by `dtMs` and draw the frame at progress derived from `elapsedMs` onto `ctx`. */
  step(ctx: CanvasRenderingContext2D, elapsedMs: number, dtMs: number): void;
  /** Deterministically draw the finished frame at once (restore + reduced motion) — cached per outcome. */
  renderFinal(ctx: CanvasRenderingContext2D): void;
  /** Container top-left offset (px, relative to the map center) at progress `t ∈ [0,1]`. */
  offsetAt(t: number): { x: number; y: number };
  /** Cloud duration (s) — the animated build time (NOT the 1.5 s pre-delay or the finalize timeout). */
  readonly duration: number;
  /** Whether the container drifts NE as it grows (spiral / band) or stays put (haze). */
  readonly moves: boolean;
}

/** Per-frame delta in seconds, clamped so a stall can't fling particles (first frame seeds 0.016). */
function toDt(dtMs: number): number {
  return dtMs > 0 ? Math.min(dtMs / 1000, 0.05) : 0.016;
}

/** Deterministic step for `renderFinal`, a nominal 60fps frame time chosen to approximate a typical live
 *  run — the regenerated snapshot is the end frame of a full sim stepped at this fixed rate. Since
 *  particles spawn per step, the density tracks this rate rather than the live loop's actual frame rate.
 *  TODO(MAS-50): make the cloud density frame-rate-independent, and revisit the per-system seeds (the
 *  formations are deterministic). */
const RENDER_FINAL_DT = 1 / 60;

// Spiral — `strong` / `moderate`.
interface CloudParticle {
  a: number;
  r: number;
  age: number;
  size: number;
  tone: number;
  op: number;
}

/** The 14 spawn-angle sources: 9 in the lower arc, 2 near the top, 3 weighted. */
const CLOUD_SOURCES: { angle: number; weight?: number }[] = (() => {
  const out: { angle: number; weight?: number }[] = [];
  for (let i = 1; i < 10; i++) out.push({ angle: Math.PI + (i * Math.PI) / 9 });
  for (let i = 0; i < 2; i++) out.push({ angle: (i * Math.PI) / 6 });
  out.push({ angle: 1.27, weight: 0.15 });
  out.push({ angle: 2.0, weight: 0.15 });
  out.push({ angle: 2.75, weight: 0.15 });
  return out;
})();

interface SpiralConfig {
  maxR: number;
  duration: number;
  omegaScale: number;
  seed: number;
}

/** Per-outcome spiral configs. `strong` / `moderate` only. */
const SPIRAL: Partial<Record<Outcome, SpiralConfig>> = {
  strong: { maxR: 99, duration: 10, omegaScale: 1, seed: 92653 },
  moderate: { maxR: 71.28, duration: 7, omegaScale: 0.7, seed: 58979 },
};

function createSpiralPlayer(cfg: SpiralConfig): StormPlayer {
  // Offscreen buffer, created once and reused each frame.
  const { canvas: off, ctx: offCtx } = createOffscreen();
  let rand = mulberry32(cfg.seed);
  let cloud: CloudParticle[] = [];

  function seed(): void {
    rand = mulberry32(cfg.seed);
    cloud = [];
    const seedR = Math.min(50, cfg.maxR * 0.5);
    for (let i = 0; i < 800; i++) {
      cloud.push({
        a: rand() * Math.PI * 2,
        r: rand() * seedR * NOR_SCALE,
        age: 0,
        size: 1.5 + rand() * 6,
        tone: 230 + Math.floor(rand() * 26),
        op: 0.4 + rand() * 0.4,
      });
    }
  }
  seed();

  function omega(r: number): number {
    const rr = r / NOR_SCALE;
    if (rr < 10) return 0;
    const w = rr <= 29 ? NOR_OMEGA_MAX : NOR_OMEGA_MAX * (29 / rr) ** (1 + NOR_ALPHA);
    return w * cfg.omegaScale;
  }

  function spawn(circleR: number): void {
    const r = circleR * NOR_SCALE;
    const spread = 0.405 + ((circleR - 0.5) / 98.5) * 0.7;
    const count = 1 + ((circleR - 0.5) / 98.5) * 4;
    for (const src of CLOUD_SOURCES) {
      const srcCount = Math.max(1, Math.round(count * (src.weight ?? 1)));
      for (let i = 0; i < srcCount; i++) {
        cloud.push({
          a: src.angle + (rand() - 0.5) * spread,
          r,
          age: 0,
          size: 1.5 + rand() * 6,
          tone: 230 + Math.floor(rand() * 26),
          op: 0.4 + rand() * 0.4,
        });
      }
    }
  }

  function stepPhysics(dt: number, circleR: number): void {
    spawn(circleR);
    const drift = NOR_SCALE;
    // Compact in place (write-index) instead of `.filter` — no per-frame array allocation.
    let w = 0;
    for (let i = 0; i < cloud.length; i++) {
      const c = cloud[i];
      c.a -= ((omega(c.r) * Math.PI) / 180) * dt;
      c.r -= drift * dt;
      c.age += dt;
      if (c.age < NOR_LIFE && c.r > 0) cloud[w++] = c;
    }
    cloud.length = w;
  }

  function draw(ctx: CanvasRenderingContext2D, circleR: number, t: number): void {
    if (!offCtx) return;
    ctx.clearRect(0, 0, NOR_SIZE, NOR_SIZE);
    const cr = circleR * NOR_SCALE;
    offCtx.clearRect(0, 0, NOR_SIZE, NOR_SIZE);
    for (const c of cloud) {
      const fade = 1 - c.age / NOR_LIFE;
      const edgeFade = Math.min(1, Math.max(0, (cr - c.r) / (cr * 0.3)));
      const centerFade = Math.min(1, c.r / (10 * NOR_SCALE));
      const cx = NOR_CX + c.r * Math.cos(c.a);
      const cy = NOR_CY + c.r * Math.sin(c.a);
      offCtx.fillStyle = `rgba(${c.tone},${c.tone},${c.tone},${(c.op * fade * edgeFade * centerFade).toFixed(3)})`;
      offCtx.beginPath();
      offCtx.arc(cx, cy, (c.size * NOR_SCALE) / 4, 0, Math.PI * 2);
      offCtx.fill();
    }
    composite(ctx, off, 2 + t, 0.25, t);
  }

  return {
    duration: cfg.duration,
    moves: true,
    reset: seed,
    step(ctx, elapsedMs, dtMs) {
      const t = Math.min(elapsedMs / 1000 / cfg.duration, 1);
      stepPhysics(toDt(dtMs), 0.5 + (cfg.maxR - 0.5) * t);
      draw(ctx, 0.5 + (cfg.maxR - 0.5) * t, t);
    },
    renderFinal(ctx) {
      // Fresh deterministic sim to the end at a fixed step.
      seed();
      const simDt = RENDER_FINAL_DT;
      const simSteps = Math.round(cfg.duration / simDt);
      for (let si = 0; si < simSteps; si++) {
        stepPhysics(simDt, 0.5 + (cfg.maxR - 0.5) * ((si + 1) / simSteps));
      }
      draw(ctx, cfg.maxR, 1);
    },
    offsetAt: driftOffset,
  };
}

// Band — `weakCoastal`.
interface BandParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  tone: number;
  op: number;
  age: number;
  life?: number;
}
interface Spawner {
  mapOffX: number;
  mapOffY: number;
  activateAt: number;
  fadeAfter: number;
}

const BAND_SEED = 32384;
const BAND_DURATION = 5;
const BAND_LIFE = 12;
const BAND_SPAWNER_COUNT = 8;

function createBandPlayer(): StormPlayer {
  const { canvas: off, ctx: offCtx } = createOffscreen();
  let rand = mulberry32(BAND_SEED);
  let band: BandParticle[] = [];
  let prevEased = 0;
  let spawners: Spawner[] = [];

  function initSpawners(): void {
    spawners = [];
    const totalDx = DRIFT_DX * NOR_SCALE;
    const totalDy = DRIFT_DY * NOR_SCALE;
    for (let i = 1; i < BAND_SPAWNER_COUNT; i++) {
      const frac = i / (BAND_SPAWNER_COUNT - 1);
      spawners.push({
        mapOffX: -totalDx * frac - 15 * NOR_SCALE,
        mapOffY: -totalDy * frac,
        activateAt:
          (((BAND_SPAWNER_COUNT - 1 - i) / (BAND_SPAWNER_COUNT - 2)) * 3.5) / BAND_DURATION,
        fadeAfter: 0.3,
      });
    }
    // Per-spawner hand-tuned nudges. `spawners` holds 7 entries (indices 0–6).
    spawners[6].mapOffX += 10 * NOR_SCALE;
    spawners[6].mapOffY -= 3 * NOR_SCALE;
    spawners[5].mapOffX -= 3 * NOR_SCALE;
    spawners[5].mapOffY -= 5 * NOR_SCALE;
    spawners[3].mapOffX -= 9 * NOR_SCALE;
    spawners[2].mapOffX += 5 * NOR_SCALE;
    spawners[2].mapOffY += 6 * NOR_SCALE;
    spawners[1].mapOffX += 13 * NOR_SCALE;
    spawners[1].mapOffY += 12 * NOR_SCALE;
    spawners[0].mapOffX += 13 * NOR_SCALE;
    spawners[0].mapOffY += 10 * NOR_SCALE;
  }

  function seed(): void {
    rand = mulberry32(BAND_SEED);
    band = [];
    prevEased = 0;
    initSpawners();
  }
  seed();

  function mapToCanvas(mapOffX: number, mapOffY: number, eased: number): { x: number; y: number } {
    return {
      x: NOR_CX + mapOffX + DRIFT_DX * (1 - eased) * NOR_SCALE,
      y: NOR_CY + mapOffY + DRIFT_DY * (1 - eased) * NOR_SCALE,
    };
  }

  function spawn(t: number): void {
    const baseAngle = -Math.PI / 4;
    const eased = 1 - (1 - t) ** 1.3;
    const spawnT = Math.min((t * BAND_DURATION) / (BAND_DURATION - 1), 1);
    const spawnEased = 1 - (1 - spawnT) ** 1.3;
    const spawnDelta = spawnEased - eased;
    const originX = NOR_CX + DRIFT_DX * spawnDelta * NOR_SCALE;
    const originY = NOR_CY + DRIFT_DY * spawnDelta * NOR_SCALE;

    const oCount = 4 + Math.floor(rand() * 5) + Math.floor(t * 40);
    for (let oi = 0; oi < oCount; oi++) {
      const fanSpread = 0.8 + rand() * 0.4 + t * 2.5;
      const a = baseAngle + (rand() - 0.5) * fanSpread;
      const speed = (6 + rand() * 12) * (1 - t * 0.4) * NOR_SCALE;
      const spawnA = rand() * Math.PI * 2;
      const spawnR = rand() * (10 + t * 30) * NOR_SCALE;
      band.push({
        x: originX + Math.cos(spawnA) * spawnR,
        y: originY + Math.sin(spawnA) * spawnR,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        size: 2 + rand() * 5,
        tone: 230 + Math.floor(rand() * 26),
        op: 0.4 + rand() * 0.4,
        life: (3 + t * 9) * (0.7 + rand() * 0.3),
        age: 0,
      });
    }

    for (let si = 0; si < spawners.length; si++) {
      const sp = spawners[si];
      const dist = eased - sp.activateAt;
      if (dist < 0) continue;
      const intensity =
        dist < sp.fadeAfter
          ? dist / sp.fadeAfter
          : Math.max(0, 1 - (dist - sp.fadeAfter) / sp.fadeAfter);
      if (intensity <= 0.01) continue;
      const sPos = mapToCanvas(sp.mapOffX, sp.mapOffY, eased);
      const spawnScale = (spawners.length - si) / spawners.length;
      const count = Math.floor((2 + rand() * 4) * intensity * (0.3 + spawnScale * 0.7));
      for (let i = 0; i < count; i++) {
        const toL = Math.atan2(NOR_CY - sPos.y, NOR_CX - sPos.x);
        const a = toL + (rand() - 0.5) * 0.8;
        const speed = (3 + rand() * 8) * NOR_SCALE;
        band.push({
          x: sPos.x + (rand() - 0.5) * 30 * NOR_SCALE,
          y: sPos.y + (rand() - 0.5) * 30 * NOR_SCALE,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          size: 1.5 + rand() * 6,
          tone: 230 + Math.floor(rand() * 26),
          op: (0.4 + rand() * 0.4) * intensity,
          age: 0,
        });
      }
    }
  }

  function draw(ctx: CanvasRenderingContext2D, t: number): void {
    if (!offCtx) return;
    ctx.clearRect(0, 0, NOR_SIZE, NOR_SIZE);
    offCtx.clearRect(0, 0, NOR_SIZE, NOR_SIZE);
    const fadeRSq = ((120 + t * 80) * NOR_SCALE) ** 2;
    const innerSq = fadeRSq * 0.49;
    const outerSq = fadeRSq * 0.51;
    for (const p of band) {
      const pLife = p.life ?? BAND_LIFE;
      const fadeOut = 1 - p.age / pLife;
      if (fadeOut <= 0) continue;
      const fade = Math.min(1, p.age / 0.5) * fadeOut;
      const dx = p.x - NOR_CX;
      const dy = p.y - NOR_CY;
      const distSq = dx * dx + dy * dy;
      const edgeFade = distSq < innerSq ? 1 : Math.max(0, 1 - (distSq - innerSq) / outerSq);
      offCtx.fillStyle = `rgba(${p.tone},${p.tone},${p.tone},${(p.op * fade * edgeFade).toFixed(3)})`;
      offCtx.beginPath();
      offCtx.arc(p.x, p.y, (p.size * NOR_SCALE) / 4, 0, Math.PI * 2);
      offCtx.fill();
    }
    composite(ctx, off, 8 + t * 4, 0.25, t);
  }

  // One physics step: drift-shift compensation, spawn, then move (with curl) + compact (with bounds).
  function physics(t: number, dt: number): void {
    const curEased = 1 - (1 - t) ** 1.3;
    const easedDelta = curEased - prevEased;
    const shiftX = -DRIFT_DX * easedDelta * NOR_SCALE;
    const shiftY = -DRIFT_DY * easedDelta * NOR_SCALE;
    prevEased = curEased;
    spawn(t);
    let w = 0;
    for (let i = 0; i < band.length; i++) {
      const p = band[i];
      const curl = Math.min(p.age / 1.5, 1);
      p.vx += curl * -3 * NOR_SCALE * dt;
      p.vy += curl * 2 * NOR_SCALE * dt;
      p.x += p.vx * dt + shiftX;
      p.y += p.vy * dt + shiftY;
      p.age += dt;
      if (
        p.age < (p.life ?? BAND_LIFE) &&
        p.x > -20 &&
        p.x < NOR_SIZE + 20 &&
        p.y > -20 &&
        p.y < NOR_SIZE + 20
      )
        band[w++] = p;
    }
    band.length = w;
  }

  return {
    duration: BAND_DURATION,
    moves: true,
    reset: seed,
    step(ctx, elapsedMs, dtMs) {
      const t = Math.min(elapsedMs / 1000 / BAND_DURATION, 1);
      physics(t, toDt(dtMs));
      draw(ctx, t);
    },
    renderFinal(ctx) {
      // Reproduce the animation deterministically with the full physics (curl + drift-shift + bounds), so
      // the restored / reduced-motion end matches what the animation actually drew.
      seed();
      const simDt = RENDER_FINAL_DT;
      const simSteps = Math.round(BAND_DURATION / simDt);
      for (let si = 0; si < simSteps; si++) physics((si + 1) / simSteps, simDt);
      draw(ctx, 1);
    },
    offsetAt: driftOffset,
  };
}

// Haze — `humidNoStorm`.
interface HazeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  tone: number;
  op: number;
  age: number;
  life: number;
}

const HAZE_SEED = 71629;
const HAZE_DURATION = 8;
/**
 * Coastline seed points. The raw values are in a 4× artboard, so rescale them to the current NOR_SCALE
 * (÷4 × NOR_SCALE) before adding the pad — the one place with coordinates hardcoded to a specific scale.
 */
const HAZE_COAST = (
  [
    [602, 545],
    [623, 487],
    [660, 430],
    [667, 373],
    [723, 316],
    [820, 258],
    [867, 201],
    [848, 143],
    [870, 85],
  ] as const
).map(([x, y]) => ({ x: (x / 4) * NOR_SCALE + NOR_PAD, y: (y / 4) * NOR_SCALE + NOR_PAD }));

function createHazePlayer(): StormPlayer {
  const { canvas: off, ctx: offCtx } = createOffscreen();
  let rand = mulberry32(HAZE_SEED);
  let particles: HazeParticle[] = [];

  function seed(): void {
    rand = mulberry32(HAZE_SEED);
    particles = [];
  }
  seed();

  function spawn(t: number): void {
    const lastActivate = 1 - 4 / HAZE_DURATION;
    for (let si = 0; si < HAZE_COAST.length; si++) {
      const activateAt = (si / (HAZE_COAST.length - 1)) * lastActivate;
      if (t < activateAt) continue;
      const sp = HAZE_COAST[si];
      const count = 1 + Math.floor(rand() * 2);
      for (let i = 0; i < count; i++) {
        const toShore =
          rand() < 0.45
            ? -Math.PI / 2 - Math.PI / 6 + (rand() - 0.5) * 0.6
            : Math.PI + (rand() - 0.5) * 1.4;
        const speed = (3 + rand() * 8) * NOR_SCALE * 0.75;
        particles.push({
          x: sp.x + (rand() - 0.5) * (15 + rand() * 40) * NOR_SCALE,
          y: sp.y + (rand() - 0.5) * (15 + rand() * 40) * NOR_SCALE,
          vx: Math.cos(toShore) * speed,
          vy: Math.sin(toShore) * speed,
          size: 1.5 + rand() * 6,
          tone: 230 + Math.floor(rand() * 26),
          op: 0.4 + rand() * 0.4,
          age: 0,
          life: 8 + rand() * 4,
        });
      }
    }
  }

  function draw(ctx: CanvasRenderingContext2D, t: number): void {
    if (!offCtx) return;
    ctx.clearRect(0, 0, NOR_SIZE, NOR_SIZE);
    offCtx.clearRect(0, 0, NOR_SIZE, NOR_SIZE);
    const fadeRSq = ((120 + t * 80) * NOR_SCALE) ** 2;
    const innerSq = fadeRSq * 0.49;
    const outerSq = fadeRSq * 0.51;
    for (const p of particles) {
      const fadeOut = 1 - p.age / p.life;
      if (fadeOut <= 0) continue;
      const fade = Math.min(1, p.age / 0.5) * fadeOut;
      const dx = p.x - NOR_CX;
      const dy = p.y - NOR_CY;
      const distSq = dx * dx + dy * dy;
      const edgeFade = distSq < innerSq ? 1 : Math.max(0, 1 - (distSq - innerSq) / outerSq);
      offCtx.fillStyle = `rgba(${p.tone},${p.tone},${p.tone},${(p.op * fade * edgeFade).toFixed(3)})`;
      offCtx.beginPath();
      offCtx.arc(p.x, p.y, (p.size * NOR_SCALE) / 4, 0, Math.PI * 2);
      offCtx.fill();
    }
    composite(ctx, off, 8 + t * 4, 0.5, t);
  }

  // One physics step: spawn onshore, drift, and compact (dropping expired / off-artboard particles).
  function physics(t: number, dt: number): void {
    spawn(t);
    let w = 0;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.age += dt;
      if (p.age < p.life && p.y > -40 && p.y < NOR_SIZE + 40) particles[w++] = p;
    }
    particles.length = w;
  }

  return {
    duration: HAZE_DURATION,
    moves: false,
    reset: seed,
    step(ctx, elapsedMs, dtMs) {
      const t = Math.min(elapsedMs / 1000 / HAZE_DURATION, 1);
      physics(t, toDt(dtMs));
      draw(ctx, t);
    },
    renderFinal(ctx) {
      // Full physics (spawn + move + the y-bounds compaction the animation uses) at a fixed step, so the
      // restored / reduced-motion end matches the animation.
      seed();
      const simDt = RENDER_FINAL_DT;
      const simSteps = Math.round(HAZE_DURATION / simDt);
      for (let si = 0; si < simSteps; si++) physics((si + 1) / simSteps, simDt);
      draw(ctx, 1);
    },
    offsetAt: driftOffset,
  };
}

/** Build the storm player for an outcome, or `null` when there's no cloud (`windy` / `fair`). */
export function createStormPlayer(outcome: Outcome): StormPlayer | null {
  const spiral = SPIRAL[outcome];
  if (spiral) return createSpiralPlayer(spiral);
  if (outcome === "weakCoastal") return createBandPlayer();
  if (outcome === "humidNoStorm") return createHazePlayer();
  return null;
}
